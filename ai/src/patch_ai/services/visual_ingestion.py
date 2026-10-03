"""Bounded local triage, proposed regions and isolated description projections."""

import hashlib
import io
import json
import re
from typing import TypedDict

from langchain_core.documents import Document
from langgraph.graph import END, START, StateGraph
from pydantic import Field
from pypdf import PdfReader
from pypdf.generic import ContentStream

from patch_ai.adapters.providers import Providers
from patch_ai.adapters.source_loader import download_source
from patch_ai.adapters.visual_renderer import render_png
from patch_ai.api.budget import remaining_seconds
from patch_ai.config import Settings
from patch_ai.observability import stage
from patch_ai.schemas.contracts import (
    ApiModel,
    VisualBounds,
    VisualDiscoverRequest,
    VisualDiscoverResult,
    VisualDocumentRequest,
    VisualIndexRequest,
    VisualIndexResult,
    VisualRegion,
    VisualTriageResult,
)
from patch_ai.services.visual_understanding import RULES


def read_pdf(request: VisualDocumentRequest, settings: Settings) -> tuple[bytes, PdfReader]:
    if request.source_file.content_type != "application/pdf":
        raise ValueError("PDF_REQUIRED")
    data = download_source(request.source_file, settings)
    reader = PdfReader(io.BytesIO(data), strict=True)
    if reader.is_encrypted or not 1 <= len(reader.pages) <= 500:
        raise ValueError("PDF_LIMIT")
    return data, reader


def triage(request: VisualDocumentRequest, settings: Settings) -> VisualTriageResult:
    result = VisualTriageResult(
        request_id=request.request_id,
        document_version_id=request.document_version_id,
        original_sha256=request.source_file.sha256.lower(),
        status="failed",
    )
    try:
        _, reader = read_pdf(request, settings)
        result.total_pages = len(reader.pages)
        with stage("visual_triage", totalPages=result.total_pages):
            for number, page in enumerate(reader.pages, 1):
                remaining_seconds(10)
                # Bound decoded content before parsing drawing operators/extracting text.
                content = page.get_contents()
                if content is not None and len(content.get_data()) > 2_000_000:
                    result.status = "partial"
                    break
                text = page.extract_text()[:20000]
                resources = page.get("/Resources")
                resources = resources.get_object() if resources is not None else {}
                objects = resources.get("/XObject")
                objects = objects.get_object() if objects is not None else {}
                images = any(
                    v.get_object().get("/Subtype") in ("/Image", "/Form") for v in objects.values()
                )
                drawings = 0
                if content is not None:
                    stream = ContentStream(content, reader)
                    drawings = sum(op in (b"l", b"c", b"re") for _, op in stream.operations)
                caption = bool(
                    re.search(r"\b(figure|diagram|schematic|wiring|flowchart|chart)\b", text, re.I)
                )
                result.scanned_pages = number
                # Mixed text/image pages must remain eligible. Decoration is rejected
                # by the bounded detector; a text-length cutoff would miss diagrams.
                if caption or drawings >= 8 or images:
                    result.pages.append(number)
                    if len(result.pages) >= settings.visual_candidate_pages:
                        result.status = "partial" if number < result.total_pages else "complete"
                        break
            else:
                result.status = "complete"
        return result
    except Exception:
        result.status = "partial" if result.scanned_pages else "failed"
        return result


class Detection(ApiModel):
    regions: list[VisualRegion] = Field(max_length=4)
    more_regions: bool


class DiscoveryState(TypedDict, total=False):
    preview: bytes
    detection: Detection


def discover(
    request: VisualDiscoverRequest, settings: Settings, providers: Providers
) -> VisualDiscoverResult:
    result = VisualDiscoverResult(
        request_id=request.request_id,
        document_version_id=request.document_version_id,
        original_sha256=request.source_file.sha256.lower(),
        page=request.page,
        status="failed",
    )

    def preview(state: DiscoveryState) -> DiscoveryState:
        data, _ = read_pdf(request, settings)
        pixels, _, _ = render_png(
            data, request.page, VisualBounds(), settings.visual_preview_dpi, settings
        )
        return {"preview": pixels}

    def detect(state: DiscoveryState) -> DiscoveryState:
        assert "preview" in state
        return {
            "detection": providers.model(
                Detection,
                RULES + " Propose only meaningful technical figures, diagrams, charts, tables or "
                "photos. Exclude logos, borders and decorative images. Return tight normalized "
                "top-left bounds in displayed page coordinates, including labels/caption. "
                "Return zero "
                "regions when none qualify. Flag more_regions if truncated; no guessed facts.",
                "Maximum regions: " + str(settings.visual_regions_per_page),
                routing=True,
                images=(state["preview"],),
            )
        }

    try:
        graph = StateGraph(DiscoveryState)
        graph.add_node("preview", preview)
        graph.add_node("detect", detect)
        graph.add_edge(START, "preview")
        graph.add_edge("preview", "detect")
        graph.add_edge("detect", END)
        detection = graph.compile().invoke({})["detection"]
        result.regions = detection.regions[: settings.visual_regions_per_page]
        result.status = (
            "partial"
            if detection.more_regions or len(detection.regions) > len(result.regions)
            else "complete"
        )
    except Exception:
        pass
    return result


def description_fingerprint(request: VisualIndexRequest) -> str:
    # Matches Web's JSON.stringify over this explicit ordered projection.
    description = request.description
    canonical = dict(
        descriptionVersion=description.description_version,
        summary=description.summary,
        labels=description.labels,
        relationships=description.relationships,
        uncertainties=description.uncertainties,
    )
    return hashlib.sha256(
        json.dumps(canonical, ensure_ascii=False, separators=(",", ":")).encode()
    ).hexdigest()


def index(
    request: VisualIndexRequest, settings: Settings, providers: Providers
) -> VisualIndexResult:
    result = VisualIndexResult(
        request_id=request.request_id,
        asset_id=request.asset.asset_id,
        description_fingerprint=request.description_fingerprint,
        embedding_model=settings.openai_embedding_model,
        status="failed",
    )
    try:
        if request.description_fingerprint != description_fingerprint(request):
            raise ValueError("DESCRIPTION_FINGERPRINT_MISMATCH")
        asset = request.asset
        description = request.description
        metadata = {
            "recordType": "IMAGE_REGION",
            "tenantId": request.tenant_id,
            "environment": settings.pinecone_namespace,
            "approvalState": "APPROVED",
            "assetId": asset.asset_id,
            "documentId": asset.document_id,
            "documentVersionId": asset.document_version_id,
            "page": asset.page,
            "sha256": asset.sha256,
            "originalSha256": asset.original_sha256,
            "descriptionFingerprint": request.description_fingerprint,
            "embeddingModel": settings.openai_embedding_model,
            "visualClass": request.visual_class,
            "confidence": request.confidence,
            "uncertaintyCount": len(description.uncertainties),
            "pipelineVersion": "visual-index-v1",
            "rendererVersion": asset.renderer_version,
            **asset.bounds.model_dump(),
        }
        text = "\n".join(
            [
                description.summary,
                *description.labels,
                *description.relationships,
                *["Uncertain: " + u for u in description.uncertainties],
            ]
        )
        providers.visual_upsert(
            Document(page_content=text, metadata=metadata),
            f"visual:{request.tenant_id}:{asset.asset_id}:{request.description_fingerprint}",
        )
        result.status = "indexed"
    except Exception:
        pass
    return result


def delete_filter(tenant: str, version: str, settings: Settings) -> dict[str, object]:
    return {
        "$and": [
            {"tenantId": {"$eq": tenant}},
            {"environment": {"$eq": settings.pinecone_namespace}},
            {"recordType": {"$eq": "IMAGE_REGION"}},
            {"documentVersionId": {"$eq": version}},
        ]
    }
