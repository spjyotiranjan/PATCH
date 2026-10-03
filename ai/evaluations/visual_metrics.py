"""Score recorded Phase 7 evidence without provider calls or raw document content.

Input is a metadata-only JSON array following VisualCase. Use reviewed observations,
not model self-ratings. This tool measures evidence; it cannot grant SME acceptance.
"""

import argparse
import json
import math
import statistics
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from patch_ai.schemas.contracts import VisualBounds


class Region(BaseModel):
    model_config = ConfigDict(extra="forbid")
    page: int = Field(ge=1, le=500)
    bounds: VisualBounds


class VisualCase(BaseModel):
    model_config = ConfigDict(extra="forbid")
    modality: Literal["diagram", "chart", "photo", "screenshot", "scan", "mixed", "decoration"]
    reviewed: bool = False
    relevant_pages: list[int]
    candidate_pages: list[int]
    expected_regions: list[Region]
    detected_regions: list[Region]
    relevant_assets: list[str]
    descriptor_matches: list[str]
    selected_assets: list[str]
    cited_assets: list[str]
    authorized_assets: list[str]
    inspected_assets: list[str]
    current_assets: list[str]
    valid_bindings: int = Field(ge=0)
    claims: int = Field(ge=0)
    grounded_claims: int | None = Field(default=None, ge=0)
    baseline_text_recall: float = Field(ge=0, le=1)
    multimodal_text_recall: float = Field(ge=0, le=1)
    baseline_ms: float = Field(ge=0)
    multimodal_ms: float = Field(ge=0)
    provider_calls: int = Field(ge=0)
    image_bytes: int = Field(ge=0)
    estimated_cost_usd: float | None = Field(default=None, ge=0)
    evidence_state_correct: bool
    partial_coverage_disclosed: bool


def overlap(a: Region, b: Region) -> float:
    if a.page != b.page:
        return 0
    x, y = a.bounds, b.bounds
    intersection = max(0, min(x.right, y.right) - max(x.left, y.left)) * max(
        0, min(x.bottom, y.bottom) - max(x.top, y.top)
    )
    union = (
        (x.right - x.left) * (x.bottom - x.top)
        + (y.right - y.left) * (y.bottom - y.top)
        - intersection
    )
    return intersection / union


def precision_recall(
    found: list[str] | list[int], expected: list[str] | list[int]
) -> dict[str, float]:
    hits = len(set(found) & set(expected))
    return {
        "precision": hits / len(set(found)) if found else float(not expected),
        "recall": hits / len(set(expected)) if expected else float(not found),
    }


def score(case: VisualCase) -> dict[str, object]:
    unmatched = set(range(len(case.expected_regions)))
    hits = 0
    for region in case.detected_regions:
        candidate = max(
            unmatched, key=lambda i: overlap(region, case.expected_regions[i]), default=None
        )
        if candidate is not None and overlap(region, case.expected_regions[candidate]) >= 0.5:
            hits += 1
            unmatched.remove(candidate)
    cited = set(case.cited_assets)
    permitted = set(case.authorized_assets) & set(case.inspected_assets) & set(case.current_assets)
    binding_valid = (
        case.valid_bindings == len(case.cited_assets)
        and len(cited) == len(case.cited_assets)
        and cited <= permitted
        and cited <= set(case.selected_assets)
    )
    if case.grounded_claims is not None and case.grounded_claims > case.claims:
        raise ValueError("Grounded claim count exceeds total claims")
    return {
        "modality": case.modality,
        "reviewed": case.reviewed,
        "pageTriage": precision_recall(case.candidate_pages, case.relevant_pages),
        "regionPrecisionAtIoU50": hits / len(case.detected_regions)
        if case.detected_regions
        else float(not case.expected_regions),
        "regionRecallAtIoU50": hits / len(case.expected_regions)
        if case.expected_regions
        else float(not case.detected_regions),
        "descriptorSearch": precision_recall(case.descriptor_matches, case.relevant_assets),
        "relevanceGate": precision_recall(case.selected_assets, case.relevant_assets),
        "citationBindingsValid": binding_valid,
        "groundedness": case.grounded_claims / case.claims
        if case.reviewed and case.grounded_claims is not None and case.claims
        else None,
        "textRecallRegression": case.multimodal_text_recall < case.baseline_text_recall,
        "baselineMs": case.baseline_ms,
        "multimodalMs": case.multimodal_ms,
        "providerCalls": case.provider_calls,
        "imageBytes": case.image_bytes,
        "estimatedCostUsd": case.estimated_cost_usd,
        "guardPassed": binding_valid
        and case.evidence_state_correct
        and case.partial_coverage_disclosed
        and case.multimodal_text_recall >= case.baseline_text_recall,
    }


def report(cases: list[VisualCase]) -> dict[str, object]:
    if not cases:
        raise ValueError("A non-empty recorded dataset is required")
    results = [score(case) for case in cases]
    latencies = sorted(case.multimodal_ms for case in cases)
    return {
        "cases": results,
        "guardGatePassed": all(r["guardPassed"] for r in results),
        "p50Ms": statistics.median(latencies),
        "p95Ms": latencies[math.ceil(len(latencies) * 0.95) - 1],
        "reviewedCases": sum(case.reviewed for case in cases),
        "smeAccepted": False,
        "automaticRolloutApproved": False,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cases", type=Path, help="Private recorded metadata JSON, outside the repo")
    args = parser.parse_args()
    try:
        result = report(
            [
                VisualCase.model_validate(c)
                for c in json.loads(args.cases.read_text(encoding="utf-8"))
            ]
        )
    except Exception:
        parser.exit(2, "Invalid visual evidence dataset. See the testing guide; no data printed.\n")
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result["guardGatePassed"] else 1)
