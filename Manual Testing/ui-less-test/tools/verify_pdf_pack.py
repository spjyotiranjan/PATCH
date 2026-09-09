"""Validate and render the UI-less PDF pack into an external QA directory."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pdfplumber
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader


def page_indexes(page_count: int, all_pages: bool) -> list[int]:
    if all_pages:
        return list(range(page_count))
    return sorted({0, page_count // 2, page_count - 1})


def contact_sheets(images: list[tuple[str, Image.Image]], output: Path, prefix: str) -> None:
    font = ImageFont.truetype("arial.ttf", 18)
    tile_w, tile_h = 430, 640
    columns, rows = 3, 2
    for sheet_index in range(0, len(images), columns * rows):
        batch = images[sheet_index : sheet_index + columns * rows]
        sheet = Image.new("RGB", (columns * tile_w, rows * tile_h), "#DCE5EA")
        draw = ImageDraw.Draw(sheet)
        for index, (label, image) in enumerate(batch):
            col, row = index % columns, index // columns
            thumbnail = image.copy()
            thumbnail.thumbnail((400, 565), Image.Resampling.LANCZOS)
            x = col * tile_w + (tile_w - thumbnail.width) // 2
            y = row * tile_h + 38
            sheet.paste(thumbnail, (x, y))
            draw.text((col * tile_w + 14, row * tile_h + 10), label, fill="#102A43", font=font)
        sheet.save(output / f"{prefix}-{sheet_index // (columns * rows) + 1}.png")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pack_root", type=Path)
    parser.add_argument("qa_output", type=Path)
    args = parser.parse_args()

    pack_root = args.pack_root.resolve()
    qa_output = args.qa_output.resolve()
    qa_output.mkdir(parents=True, exist_ok=True)

    summaries: list[dict[str, object]] = []
    fixture_images: list[tuple[str, Image.Image]] = []
    official_images: list[tuple[str, Image.Image]] = []

    for path in sorted((pack_root / "pdfs").rglob("*.pdf")):
        reader = PdfReader(str(path), strict=True)
        if reader.is_encrypted or not reader.pages:
            raise RuntimeError(f"Invalid PDF: {path}")
        text_counts = [len((page.extract_text() or "").strip()) for page in reader.pages]
        relative = path.relative_to(pack_root).as_posix()
        is_fixture = "pdfs/fixtures/" in relative
        if path.name == "05_OCR_Shift_Inspection_Card.pdf" and text_counts != [0]:
            raise RuntimeError("OCR card unexpectedly contains a native text layer")
        if is_fixture and path.name != "05_OCR_Shift_Inspection_Card.pdf" and any(
            count < 30 for count in text_counts
        ):
            raise RuntimeError(f"Native fixture has an unreadable page: {relative}")

        summaries.append(
            {
                "file": relative,
                "bytes": path.stat().st_size,
                "pages": len(reader.pages),
                "textCharactersByPage": text_counts,
            }
        )

        indexes = page_indexes(len(reader.pages), all_pages=is_fixture)
        with pdfplumber.open(path) as document:
            for page_index in indexes:
                rendered = document.pages[page_index].to_image(resolution=100).original.convert("RGB")
                label = f"{path.name} p{page_index + 1}"
                target = fixture_images if is_fixture else official_images
                target.append((label, rendered))

    contact_sheets(fixture_images, qa_output, "fixtures")
    contact_sheets(official_images, qa_output, "official-samples")
    print(json.dumps(summaries, indent=2))


if __name__ == "__main__":
    main()
