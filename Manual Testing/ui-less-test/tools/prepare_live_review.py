"""Prepare local native-text expectations for synthetic acceptance fixtures only.

Run with the existing AI Python environment. Outputs go to the system temp
directory containing this run's private state, never into the repository.
"""
import json
import sys
import tempfile
from pathlib import Path

from docx import Document
from pypdf import PdfReader

run_id = sys.argv[1]
if not run_id.replace("-", "").isalnum():
    raise SystemExit("Invalid run ID")
directory = Path(tempfile.gettempdir()) / f"patch-acceptance-{run_id}"
state = json.loads((directory / "private-state.json").read_text(encoding="utf-8"))
note = "Synthetic format test. The record identifier is FORMAT-17. No physical work was performed."
(directory / "synthetic-note.md").write_text(note, encoding="utf-8")
docx_path = directory / "synthetic-note.docx"
if not docx_path.exists():
    document = Document()
    document.add_paragraph(note)
    document.save(docx_path)
expected = {}
for key, item in state["docs"].items():
    source = Path(item["file"])
    if key in {"ocr", "doe", "osha", "badHash"}:
        continue
    if source.suffix == ".pdf":
        pages = [(page.extract_text() or "").strip() for page in PdfReader(source).pages]
    elif source.suffix == ".docx":
        pages = [note]
    else:
        text = source.read_bytes().decode("utf-8-sig").strip()
        pages = [text[offset : offset + 20000] for offset in range(0, len(text), 20000)]
    expected[key] = pages
    print(f"{key}: {len(pages)} native text pages/blocks")
(directory / "expected-pages.json").write_text(json.dumps(expected), encoding="utf-8")
