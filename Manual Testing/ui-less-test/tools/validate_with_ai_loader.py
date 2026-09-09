"""Exercise the committed P.A.T.C.H. PDF loader against the fixture pack."""

from __future__ import annotations

from pathlib import Path

from langchain_core.documents import Document

from patch_ai.adapters.ocr import available
from patch_ai.adapters.source_loader import VerifiedSourceLoader
from patch_ai.config import Settings

PACK_ROOT = Path(__file__).resolve().parents[1]
FIXTURES = PACK_ROOT / "pdfs" / "fixtures"
OFFICIAL = PACK_ROOT / "pdfs" / "official"


def load(path: Path) -> list[Document]:
    return VerifiedSourceLoader(path.read_bytes(), "application/pdf", Settings()).load()


def main() -> None:
    if not available(Settings()):
        raise RuntimeError("OCR runtime unavailable; follow Setup_Guide.md before this check")
    native = sorted(FIXTURES.glob("0[1-4]_*.pdf"))
    for path in native:
        pages = load(path)
        qualities = [page.metadata["extractionQuality"] for page in pages]
        if not pages or any(quality not in (0.6, 1.0) for quality in qualities):
            raise RuntimeError(f"Unexpected native extraction result for {path.name}")
        print(f"PASS PDF {path.name}: pages={len(pages)} minimumQuality={min(qualities)}")

    doe_path = OFFICIAL / "DOE_Improving_Pumping_System_Performance.pdf"
    doe_pages = load(doe_path)
    if len(doe_pages) != 122 or any(
        page.metadata["extractionQuality"] not in (0.6, 1.0) for page in doe_pages
    ):
        raise RuntimeError("Unexpected DOE sourcebook extraction result")
    print(f"PASS official {doe_path.name}: pages={len(doe_pages)}")

    ocr_path = FIXTURES / "05_OCR_Shift_Inspection_Card.pdf"
    pages = load(ocr_path)
    if len(pages) != 1 or pages[0].metadata["extractionQuality"] != 0.6:
        raise RuntimeError("Unexpected OCR extraction result")
    text = pages[0].page_content
    for token in (
        "CW-17",
        "3.1 bar",
        "PT-101",
        "2026-08-14 09:40 IST",
        "TEST ONLY - NO PHYSICAL MAINTENANCE",
        "NONE - observation only",
    ):
        if token.lower() not in text.lower():
            raise RuntimeError(f"OCR token missing: {token}")
    print("PASS OCR 05_OCR_Shift_Inspection_Card.pdf: pages=1 quality=0.6")

    osha_path = OFFICIAL / "OSHA_Control_of_Hazardous_Energy.pdf"
    osha_pages = load(osha_path)
    if len(osha_pages) != 45:
        raise RuntimeError("Unexpected OSHA publication page count")
    print(
        f"PASS official {osha_path.name}: pages={len(osha_pages)} "
        f"minimumQuality={min(page.metadata['extractionQuality'] for page in osha_pages)}"
    )


if __name__ == "__main__":
    main()
