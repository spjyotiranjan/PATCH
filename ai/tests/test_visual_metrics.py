import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    "visual_metrics", Path(__file__).parents[1] / "evaluations" / "visual_metrics.py"
)
assert spec and spec.loader
metrics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(metrics)


def sample():
    return metrics.VisualCase(
        modality="diagram",
        relevant_pages=[1],
        candidate_pages=[1],
        expected_regions=[{"page": 1, "bounds": {}}],
        detected_regions=[{"page": 1, "bounds": {}}, {"page": 1, "bounds": {}}],
        relevant_assets=["asset"],
        descriptor_matches=["asset"],
        selected_assets=["asset"],
        cited_assets=["asset"],
        authorized_assets=["asset"],
        inspected_assets=["asset"],
        current_assets=["asset"],
        valid_bindings=1,
        claims=1,
        grounded_claims=1,
        baseline_text_recall=1,
        multimodal_text_recall=1,
        baseline_ms=10,
        multimodal_ms=20,
        provider_calls=3,
        image_bytes=200,
        evidence_state_correct=True,
        partial_coverage_disclosed=True,
    )


def test_duplicate_regions_penalize_precision_and_unreviewed_groundedness_is_unknown():
    result = metrics.score(sample())
    assert result["regionPrecisionAtIoU50"] == 0.5
    assert result["regionRecallAtIoU50"] == 1
    assert result["groundedness"] is None
    assert metrics.report([sample()])["automaticRolloutApproved"] is False


@pytest.mark.parametrize("field", ["authorized_assets", "inspected_assets", "current_assets"])
def test_stale_uninspected_or_unauthorized_binding_fails(field):
    case = sample()
    setattr(case, field, [])
    assert metrics.report([case])["guardGatePassed"] is False
