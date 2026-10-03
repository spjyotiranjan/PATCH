"""Validate bounded immutable PNG pixels without broadening document ingestion MIME types."""

import hashlib
import io

from PIL import Image

from patch_ai.adapters.source_loader import SourceRejected, download_source
from patch_ai.config import Settings
from patch_ai.schemas.contracts import VisualDescribeRequest


def load_pixels(request: VisualDescribeRequest, settings: Settings) -> bytes:
    limited = settings.model_copy(
        update={
            "supported_document_mime_types": "image/png",
            "source_download_max_bytes": min(settings.source_download_max_bytes, 2_000_000),
        }
    )
    data = download_source(request.source_file, limited)
    asset = request.asset
    if len(data) != asset.byte_count or hashlib.sha256(data).hexdigest() != asset.sha256.lower():
        raise SourceRejected("VISUAL_CHECKSUM_MISMATCH")
    with Image.open(io.BytesIO(data)) as image:
        if (
            image.format != "PNG"
            or image.size != (asset.width, asset.height)
            or image.width * image.height > 4_000_000
            or getattr(image, "n_frames", 1) != 1
        ):
            raise SourceRejected("VISUAL_PIXELS_INVALID")
        image.verify()
    return data
