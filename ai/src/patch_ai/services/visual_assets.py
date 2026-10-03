"""Bounded visual derivatives; source access and persistent storage remain Web-owned."""

import base64
import hashlib

from patch_ai.adapters.source_loader import SourceRejected, download_source
from patch_ai.adapters.visual_renderer import render_png
from patch_ai.config import Settings
from patch_ai.schemas.contracts import (
    ServiceError,
    VisualRenderRequest,
    VisualRenderResult,
    VisualSourceAsset,
)


def render(request: VisualRenderRequest, settings: Settings) -> VisualRenderResult:
    try:
        if request.source_file.content_type != "application/pdf":
            raise SourceRejected("VISUAL_PDF_REQUIRED")
        data = download_source(request.source_file, settings)
        png, width, height = render_png(
            data, request.page, request.bounds, request.render_dpi, settings
        )
        asset = VisualSourceAsset(
            asset_id=request.asset_id,
            document_id=request.document_id,
            document_version_id=request.document_version_id,
            page=request.page,
            bounds=request.bounds,
            original_sha256=request.source_file.sha256.lower(),
            sha256=hashlib.sha256(png).hexdigest(),
            byte_count=len(png),
            width=width,
            height=height,
            render_dpi=request.render_dpi,
        )
        return VisualRenderResult(
            request_id=request.request_id,
            status="rendered",
            asset=asset,
            png_base64=base64.b64encode(png).decode("ascii"),
        )
    except Exception:
        # Never return a parser exception, signed URL, source text or partial image.
        return VisualRenderResult(
            request_id=request.request_id,
            status="failed",
            errors=[
                ServiceError(code="VISUAL_RENDER_FAILED", message="Visual source unavailable.")
            ],
        )
