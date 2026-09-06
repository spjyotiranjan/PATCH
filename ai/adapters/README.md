# Parser boundary decision (2026-09-06)

Models, embeddings and vector operations use the existing maintained
`langchain-openai` and `langchain-pinecone` integrations; orchestration uses
LangGraph. Declare `langchain-core` directly for Documents/BaseLoader (MIT,
Python >=3.10, compatible with the locked LangChain family).

Do not add `langchain-community`: its upstream repository was archived on June
19, 2026 and says it is no longer maintained:
https://github.com/langchain-ai/langchain-community.
`src/patch_ai/adapters/source_loader.py` instead implements LangChain BaseLoader
using already-declared pypdf, Pillow, pytesseract and python-docx. This is a narrow local
parsing exception, not a provider-SDK workflow. Accept PDF, UTF-8 text/Markdown,
and bounded text/table DOCX. python-docx is MIT and its maintained
[document API](https://python-docx.readthedocs.io/en/latest/api/document.html)
preserves paragraph/table order. DOCX images, embeddings, nested tables, tracked
changes, external relationships and unsupported text boxes are rejected; export
these to a reviewable PDF instead. Text/DOCX use block anchors, not print-page claims.
Scanned-image OCR requires Tesseract; missing OCR/unreadable pages fail
extraction rather than silently indexing incomplete safety instructions.
PyMuPDF is not used; its license needs separate approval before adoption.

Downloading is separate: HTTPS host allowlist, public DNS, no redirects, bounded
bytes/type/checksum, and no persisted signed URLs. Tests protect anchors and
deterministic chunks. Migration: replace only this BaseLoader when a maintained,
license-compatible LangChain integration supports equivalent bounded inputs.
Reindex a new pipeline version before activation; preserve originals/history.
