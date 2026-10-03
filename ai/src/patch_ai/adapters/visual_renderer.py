"""Exact PDF regions using the existing bounded parser/rendering adapter boundary."""

import io
import math

from pypdf import PdfReader

from patch_ai.adapters.ocr import render_page
from patch_ai.adapters.source_loader import SourceRejected
from patch_ai.api.budget import remaining_seconds
from patch_ai.config import Settings
from patch_ai.schemas.contracts import VisualBounds


def render_png(
    data: bytes, page_number: int, bounds: VisualBounds, dpi: int, settings: Settings
) -> tuple[bytes, int, int]:
    if not data.startswith(b"%PDF-"):
        raise SourceRejected("VISUAL_PDF_REQUIRED")
    reader = PdfReader(io.BytesIO(data), strict=True)
    if reader.is_encrypted or not 1 <= len(reader.pages) <= 500:
        raise SourceRejected("VISUAL_PDF_REJECTED")
    if page_number > len(reader.pages):
        raise SourceRejected("VISUAL_PAGE_NOT_FOUND")
    # Reuse the PDFium mutex, buffer cleanup and page allocation guard.
    rendering = settings.model_copy(
        update={
            "ocr_render_dpi": dpi,
            "ocr_max_image_pixels": min(settings.ocr_max_image_pixels, 4_000_000),
        }
    )
    with render_page(data, page_number - 1, rendering) as page:
        box = (
            math.floor(bounds.left * page.width),
            math.floor(bounds.top * page.height),
            math.ceil(bounds.right * page.width),
            math.ceil(bounds.bottom * page.height),
        )
        with page.crop(box) as crop, crop.convert("RGB") as rgb:
            if max(rgb.size) > 4096:
                raise SourceRejected("VISUAL_SIZE_LIMIT")
            remaining_seconds(15)
            buffer = io.BytesIO()
            rgb.save(buffer, format="PNG", compress_level=6)
            png = buffer.getvalue()
            if len(png) > 2_000_000:
                raise SourceRejected("VISUAL_SIZE_LIMIT")
            return png, rgb.width, rgb.height
