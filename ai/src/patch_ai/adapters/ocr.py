"""Local OCR/runtime boundary. No source text, paths or subprocess output is logged."""

import math
import os
import shutil
import subprocess
import threading
import time
from pathlib import Path
from typing import cast

from PIL import Image, ImageChops

from patch_ai.api.budget import remaining_seconds
from patch_ai.config import Settings

_pdf_lock = threading.Lock()
_ocr_lock = threading.Lock()


def executable(settings: Settings) -> str:
    if settings.ocr_tesseract_cmd:
        candidate = shutil.which(settings.ocr_tesseract_cmd)
        if candidate:
            return candidate
        raise ValueError("OCR_UNAVAILABLE")
    found = shutil.which("tesseract")
    if found:
        return found
    if os.name == "nt":
        for root, suffix in (
            (os.environ.get("LOCALAPPDATA"), "Programs/Tesseract-OCR/tesseract.exe"),
            (os.environ.get("PROGRAMFILES"), "Tesseract-OCR/tesseract.exe"),
        ):
            if root and (candidate_path := Path(root) / suffix).is_file():
                return str(candidate_path)
    raise ValueError("OCR_UNAVAILABLE")


def available(settings: Settings) -> bool:
    try:
        result = subprocess.run(
            [executable(settings), "--list-langs"],
            capture_output=True,
            text=True,
            timeout=3,
            check=True,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        languages = set(result.stdout.splitlines()[1:])
        return set(settings.ocr_languages.split("+")).issubset(languages)
    except (OSError, ValueError, subprocess.SubprocessError):
        return False


def image_text(image: Image.Image, settings: Settings) -> str:
    import pytesseract  # type: ignore[import-untyped]

    if image.width * image.height > settings.ocr_max_image_pixels:
        raise ValueError("SOURCE_IMAGE_TOO_LARGE")
    # pytesseract's executable selection is global. Serialize configuration/call
    # so concurrent extraction requests cannot race with another configuration.
    if not _ocr_lock.acquire(timeout=remaining_seconds(settings.ocr_timeout_seconds)):
        raise TimeoutError("OCR_CAPACITY_TIMEOUT")
    previous = pytesseract.pytesseract.tesseract_cmd
    try:
        pytesseract.pytesseract.tesseract_cmd = executable(settings)
        deadline = time.monotonic() + settings.ocr_timeout_seconds

        def recognize(candidate: Image.Image) -> str:
            timeout = min(
                remaining_seconds(settings.ocr_timeout_seconds), deadline - time.monotonic()
            )
            if timeout <= 0:
                raise TimeoutError("OCR_TIMEOUT")
            return str(
                pytesseract.image_to_string(
                    candidate,
                    lang=settings.ocr_languages,
                    timeout=timeout,  # pyright: ignore[reportArgumentType]
                )
            ).strip()

        text = recognize(image)
        # A colour warning on a dark panel can be missed by Tesseract's default
        # grayscale conversion. A bounded red-channel pass recovers additional
        # glyphs without replacing the primary transcription or guessing values.
        # Novel/ambiguous readings remain visible for mandatory source review.
        with image.convert("RGB") as rgb:
            red, green, blue = rgb.split()
            try:
                with ImageChops.difference(red, green) as difference:
                    coloured = difference.getbbox() is not None
                if coloured:
                    extra = recognize(red)
                    known = {" ".join(line.split()).casefold() for line in text.splitlines()}
                    additions = [
                        line
                        for line in extra.splitlines()
                        if line.strip() and " ".join(line.split()).casefold() not in known
                    ]
                    if additions:
                        text = "\n\n".join([text, "\n".join(additions)]).strip()
            finally:
                red.close()
                green.close()
                blue.close()
        return text
    finally:
        pytesseract.pytesseract.tesseract_cmd = previous
        _ocr_lock.release()


def render_page(data: bytes, page_index: int, settings: Settings) -> Image.Image:
    # PDFium is not thread-safe, including across distinct documents. Keep all
    # native object creation/use/destruction inside the same process-wide mutex.
    if not _pdf_lock.acquire(timeout=remaining_seconds(settings.ocr_timeout_seconds)):
        raise TimeoutError("PDF_RENDER_CAPACITY_TIMEOUT")
    try:
        import pypdfium2 as pdfium  # type: ignore[import-untyped]

        with pdfium.PdfDocument(data) as pdf:
            page = pdf[page_index]
            try:
                width, height = page.get_size()
                scale = settings.ocr_render_dpi / 72
                if (
                    not all(math.isfinite(v) and v > 0 for v in (width, height))
                    or math.ceil(width * scale) * math.ceil(height * scale)
                    > settings.ocr_max_image_pixels
                ):
                    raise ValueError("SOURCE_IMAGE_TOO_LARGE")
                remaining_seconds(settings.ocr_timeout_seconds)
                bitmap = page.render(scale=scale)  # pyright: ignore[reportArgumentType]
                try:
                    # Copy before closing PDFium's bitmap buffer.
                    return cast(Image.Image, bitmap.to_pil().copy())
                finally:
                    bitmap.close()
            finally:
                page.close()
    finally:
        _pdf_lock.release()
