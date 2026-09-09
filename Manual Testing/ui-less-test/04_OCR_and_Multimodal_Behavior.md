# OCR and multimodal behavior

## What the implementation does today

For a PDF page, the AI source loader first asks `pypdf` for extractable text.

- Native-only pages retain text with extraction quality `1.0`. On mixed pages,
  native text is retained and Tesseract reads embedded raster images; additional
  recognized text is appended and the page is marked `0.6`. Pixels are not embedded.
- If the page has fewer than 30 extracted characters, the bounded pypdfium2
  renderer rasterizes the whole page before Tesseract OCR. This supports composite
  scans and page orientation instead of depending on separately extractable images.
  OCR text remains page-anchored with extraction quality `0.6`.
- A bounded colour-contrast pass can recover additional glyphs on coloured panels.
  It does not replace the primary reading or resolve ambiguous values. Review
  every value, unit and warning against the original. Quality is a fixed review
  marker, not an accuracy probability; OCR does not guarantee complete transcription.
- If no usable text is produced, an image is unreadable, the PDF is encrypted,
  or a configured page/image/text bound is exceeded, extraction fails for human
  review. It does not silently index an incomplete page.

After extraction, the page text is chunked, embedded through the configured
OpenAI embedding model, and stored as `SOURCE_CHUNK` vectors with the immutable
document/version identity, physical PDF page, section anchor, approval state,
extraction quality, fingerprint, tenant, and environment. Pinecone stores derived
vectors; MongoDB and R2 remain authoritative.

## Mixed text and image pages

A page containing both normal text and a diagram is currently **text-grounded,
not vision-grounded**. Extractable headings, captions, labels, and descriptions
can be retrieved efficiently. Information conveyed only through shape, colour,
position, a plotted trend, or unlabeled image content is not represented in the
vector space.

Consequences:

- “What does the caption say the feedback signal is?” can work when the caption
  states `4-20 mA`.
- “What colour is the anomaly marker?” must not be answered from the current
  vector index when colour appears only in pixels.
- OCR is not a general image-understanding system. It can read visible glyphs
  from an image-only page, but it does not reliably interpret relationships in a
  wiring diagram, photograph, chart, or exploded view.

## Can the image be fetched and shown?

The original PDF can be fetched efficiently through Web’s source endpoint after
fresh authorization. A citation identifies the document version and physical
page, so a UI can open the original at the relevant page. The current backend
does **not** extract each embedded image as a separately addressable asset, store
image regions, create image embeddings, return bounding boxes, or return an image
thumbnail in a Chat citation. Therefore it cannot fetch “the matched image” as a
standalone result today.

This is deliberate safe behavior: current answers are supported by exact source
text. The image remains available for human inspection in the immutable original.

## Test procedure

### Native mixed page

1. Upload and activate `04_Multimodal_Control_Loop_Diagnostic.pdf`.
2. Confirm extraction quality is `0.6` on raster-containing pages (`1.0` on native-only
   pages) and page 1 text contains the written signal
   path and caption.
3. Ask: `Which instrument provides the feedback signal, and what signal type is written?`
4. Expect a cited answer naming PT-101 and 4-20 mA from page text.
5. Ask: `What colour is the anomaly diamond in the figure?`
6. Expect no grounded colour claim. `incomplete` is acceptable. An answer claiming
   orange without text evidence is a failure.

### Image-only OCR page

1. Verify OCR discovery/language readiness using the command in `Setup_Guide.md`;
   PATH or the configured/standard Windows installation is supported.
2. Upload `05_OCR_Shift_Inspection_Card.pdf` as a direct Project document.
3. Poll for `NEEDS_REVIEW`; inspect page 1 and extraction quality `0.6`.
4. Compare every OCR field to the raster original. Do not approve if `CW-17`,
   `3.1 bar(g)`, `2026-08-14`, or `PT-101` is misread.
5. After human approval/index/activation, ask for the observation code and pressure.
6. Require a page-1 citation and wording that treats the card as an observation,
   not proof that maintenance was performed.

### Native-text priority edge case

Mixed-page native text no longer suppresses raster-label OCR. Test that both
caption text and raster-only glyphs survive with the same physical page anchor.
Pure shape/colour/position information is still not interpreted. This change
applies to newly processed versions; retained active sources are not rewritten.

## What would be required for true visual retrieval

A future implementation would need a contract and evaluated pipeline for
image/region extraction, OCR with bounding boxes, visual captioning or
multimodal embeddings, separately authorized image assets, page-region citations,
and UI rendering. It would also need new safeguards for prompt injection in images,
diagram applicability, model hallucination, storage cost, latency, and source
version propagation. None of those capabilities should be inferred from the
current text/OCR index.
