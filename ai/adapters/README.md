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

## OCR repair decision (2026-09-08)

Add stable `pypdfium2` 5.x (locked with uv) solely for bounded full-page rasterization
inside this BaseLoader boundary. pypdf cannot render composite/rotated scans;
pytesseract is an OCR wrapper, not a renderer. The installed PyMuPDF dependency
remains unused because its license has not been approved. No alternate RAG stack
or vision provider is introduced. Reuse Pillow and Tesseract for OCR.

Checked upstream [installation/licensing](https://pypdfium2.readthedocs.io/en/stable/readme.html)
and [thread/lifetime rules](https://pypdfium2.readthedocs.io/en/stable/python_api.html):
prebuilt Windows/Python wheels, Apache-2.0/BSD-3-Clause bindings and BSD-style
PDFium with bundled notices. Preserve the wheel's third-party notices. Use the
stable 5.x release, bounded pixels, explicit cleanup and a process-wide rendering
mutex; PDFium is not thread-safe. No JavaScript/XFA-enabled build is requested.

AI-only OCR configuration selects executable/languages, DPI, pixel and call-time
bounds. No machine-wide PATH modification is required. Readiness checks the OCR
executable and language data, reporting aggregate status only. Low-text pages are
rendered in page coordinates before OCR. Mixed pages retain native text and append
OCR text from embedded raster images; pixel-only meaning is still not evidence.

Extraction/indexing use pipeline version 2 for new processing. Do not silently
reindex an existing active/reviewed version with changed extraction: upload a new
immutable version, compare extracted text to its original, approve, then activate.
Existing vectors/anchors remain readable. Failed, never-approved extractions may
be retried through the audited operator API. Rollback preserves originals and
active pointers; stop dispatch before reverting the parser/lockfile together.

## Phase 7 visual derivative foundation

### Pack 2 spatial OCR repair (16 September 2026)

Pipeline 4 replaces the mixed-image flattened multi-pass transcript with bounded
Tesseract word-box extraction (`--psm 6`) and a monospace layout transcription.
Low-confidence tokens may be re-read in padded crops at original and doubled scale;
replacement requires agreement of both readings with confidence >=80. At most eight
tokens are retried; each pass allows 20,000 data rows and 2,000 recognized words,
inside the existing shared deadline and pixel cap. Unresolved
readings remain review-required, not silently certified. Full-page scan processing
and native PDF text are unchanged. OCR confidence is only a retry heuristic;
extraction quality remains 0.6. No words, chart values or fixture IDs are hardcoded.

Layout whitespace preserves approximate label positions, not inferred chart data.
Chart relationships, colours and arrows still require the existing pixel-grounded
Phase 7 path. Native text and the original PDF remain authoritative review inputs.
The colour pass still supplements missing warning text. New immutable versions
and renewed review are mandatory; retained pipeline-3 versions are not rewritten.
No schema, dependency, setting or model call is added. Stop dispatch across upgrade
or rollback; retain originals and old active versions, and align extraction/index
code before processing new versions. No automatic approval or backfill.

### Pack 2 OCR follow-up (15 September 2026)

Parser/index pipeline 3 adds one supplemental Tesseract `--psm 6` block-layout
pass for embedded raster images on mixed pages. Live fixtures showed default
segmentation omitting boxed identifiers and chart numbers. Preserve the primary
reading, append only distinct lines, and retain conflicting readings for review.
All passes share one OCR deadline; no new package, model call or setting is added.
Whole-page scan behavior is unchanged. This improves label recall, not chart
pairing, geometry, colour or visual meaning. Those still require Phase 7 pixels.
See [Tesseract segmentation guidance](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html#page-segmentation-method).

Upload a new immutable version for previously extracted/reviewed/active sources;
do not mutate historical extraction or silently reindex them. Stop workers across
the upgrade and review new extraction before indexing with the matching pipeline.
Rollback retains originals, prior active pointers and vectors; process new versions
only after aligning parser/index code. No automatic backfill or source approval.

`visual_renderer.py` extends this same parser exception to page/region PNG assets.
It reuses pypdf validation, the existing PDFium lock/render function and Pillow;
no new parser stack, direct provider SDK or license dependency is introduced.
The operation performs no model reasoning and needs no orchestration graph of its
own. The service executor bounds capacity/time while Web owns queueing, immutable
R2 storage and current-version authorization. A future maintained LangChain loader
replacement must preserve the page rotation/crop convention, resource bounds and
version provenance. Change rendererVersion for incompatible output semantics;
retain old assets for rollback and create new selections instead of rewriting them.
# Visual understanding adapter

`visual_source.py` reuses the existing allowlisted, checksum-verified downloader
and Pillow to validate single-frame PNG derivatives before inference. It does not
enable image uploads in the ordinary document loader. The LangChain provider sends
bounded base64 pixels with high image detail using configured answer/verification
models; it adds no SDK or dependency. Model/provider tracing remains disabled by
the workflow executor. Description generation and independent verification use
LangGraph, and never promote generated descriptions into approved source text.
