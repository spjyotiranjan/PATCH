# Phase 7: visual asset foundation manual test

Status: implementation milestone, manual hosted acceptance not yet recorded.
This tests exact source assets. Visual search and AI image interpretation are
pending and must not be inferred from a successful render.

Automated verification (8 September 2026): 97 Web tests and 89 AI tests passed.
New coverage includes actual PDFium rotation/crops, signed loopback Web-to-AI PNG
rendering, invalid bounds/pages, provenance/checksum tampering, tenant/access/version
changes, stale leases, dead-letter recovery and response redaction. These checks use
synthetic files and isolated storage/database fixtures; they do not certify hosted
MongoDB transaction conflicts, R2 persistence or representative diagram legibility.

## Prerequisites

Run Web, AI and the Web worker using `Setup_Guide.md`. Sign in through Web Swagger
at `http://localhost:3000/api/docs` using the existing cookie/session procedure in
`Backend_Manual_Testing.md`. Use one prepared PDF that has completed
upload, extraction, review, indexing and activation; note its active version ID
and a physical one-based page containing a diagram. Keep the original PDF open
to compare the resulting image. These operations use storage and rendering only,
without paid model/embedding calls.

## Request and open a page

1. As its Equipment owner/approved manager or Project Owner, POST
   `/api/document-versions/{versionId}/visual-assets` with:

   ```json
   { "page": 1 }
   ```

2. Save the returned asset `id`. State begins `QUEUED`; GET the same path to poll.
   The worker must dispatch the `VISUAL_RENDER` job before state becomes `READY`.
3. GET `/api/visual-assets/{assetId}/source`. Open the returned short-lived `url`.
   Compare colors, orientation, diagrams and labels against the same PDF page.
   Metadata includes the version, page, bounds, SHA-256, dimensions, DPI and
   renderer version. The normal asset list contains no object key, URL or base64.
4. Repeat the identical POST: it must return the same asset ID and create no
   additional outbox event. Linking the logical document to another authorized
   Equipment/Project must reuse the same source version and asset set.

## Request a diagram crop

POST to the same version endpoint with bounds appropriate to the selected figure:

```json
{
  "page": 1,
  "bounds": { "left": 0.1, "top": 0.2, "right": 0.9, "bottom": 0.8 }
}
```

Coordinates range from 0 to 1 with origin at the displayed page's top-left corner
after PDF rotation. Bounds round outward to enclosing pixels. These example
coordinates are illustrative; they do not identify a specific fixture's figure.
Expect a different asset ID and a PNG containing exactly the selected page region
within that one-pixel rounding tolerance. No image is generated or redrawn by an LLM.

## Authorization, recovery and limits

- A reader may list/open an authorized current asset; requesting a new crop
  requires document mutation access. A different tenant/user without a current
  inclusion path must receive an access error before a URL is issued.
- Remove the user's only grant/membership or document link. New source/list
  requests must fail. Repeat after archive, approval removal or activation of a
  newer immutable version. Old objects remain retained; already-issued URLs expire
  after at most 300 seconds and must not be treated as instantly revocable.
- Crossed bounds, zero-area bounds, page zero and unknown fields must fail request
  validation. A page missing from reviewed extraction fails `VISUAL_PAGE_NOT_FOUND`.
  Non-PDF, unapproved or superseded versions fail `VISUAL_SOURCE_NOT_CURRENT`.
- At most 100 distinct explicit selections are allowed per version. The quota is
  a backend limit; do not generate 100 hosted assets merely to test it manually.
- Stop AI temporarily, request a permitted crop and inspect worker retry state.
  Original text Chat and document activation must remain unchanged. After five
  failed attempts the asset shows `FAILED`. Restore AI, retry the specific job with
  a reason using the operator procedure in `Backend_Manual_Testing.md`, and confirm
  `QUEUED` then `READY`. Do not reset migration markers or edit database state.
- Full-page allocation is capped before cropping. Oversized pages/output fail
  explicitly with no partial bytes. Lower Web `VISUAL_RENDER_DPI` and restart Web
  for a distinct request if the source can be rendered within the documented limits.

## Private FastAPI diagnostic

FastAPI `/docs` exposes `POST /v1/visual-assets/render`. Use the HMAC signing
procedure in the backend manual; match requestId to the signature and send a fresh
request UUID. Supply the reviewed immutable PDF source URL/checksum, tenant,
asset/document/version IDs, approval `APPROVED`, page, bounds, and renderDpi.
Only operators testing the private contract should inspect `pngBase64`; it is not
a browser-facing API or a persistent record. Avoid logging/copying signed URLs.

The normal application path is Web POST → durable worker → signed AI render →
Web validation/R2 storage → Web-authorized source URL. Chat sockets are unchanged
in this milestone and do not return image citations yet.

## Record acceptance

Record the test date, source document/version/page, asset ID, rendered-image visual
comparison, authorization outcomes and retry result here when executed. Exclude
credentials, signed URLs and private source content. Automated contract/render and
authorization tests are separate from this hosted visual acceptance.
# Verified description follow-up

Once a requested asset is `READY`, use Web Swagger or an authenticated Postman
request: `POST /api/visual-assets/{assetId}/describe`, JSON body `{}`. Reuse the
document owner/approved manager session. This can incur two paid model calls per
attempt, up to five attempts; run one small, legible diagram first.

Poll the same version's visual-assets list until `descriptionState` is `READY`.
Compare `description.summary`, `labels`, `relationships` and `uncertainties` against
the exact PNG obtained through the source endpoint. Verify no invented connections,
measurements, operating steps or guessed labels. Tiny/cropped/ambiguous text should
be uncertain, not confidently reconstructed. Repeating POST must not create another
job. Ordinary rendering must not invoke the description provider automatically.

Test non-owner mutation, revoked access, archived/superseded versions and a different
tenant: no new description should be queued. A failed provider must eventually
produce `descriptionState: FAILED` without making the existing PNG unavailable.
Use the operator retry route with a reason after fixing the cause. Private FastAPI
`/v1/visual-assets/describe` requires the same signed request helper as other internal
routes; unsigned Swagger calls should return 401. Do not put source URLs in reports.

These are manual acceptance instructions, not a claim of executed hosted vision
tests. Descriptions are not indexed or returned as visual Chat evidence yet.

## Planned discovery and visual-retrieval acceptance matrix

Use reviewed fixtures containing a true schematic, flow diagram, chart, equipment
photo, decorative logo, image-only scan, mixed text/image page, cropped labels,
duplicate figures and embedded prompt-injection text. Record local page-triage
selection, detected normalized bounds and avoided irrelevant regions. At quotas,
verify an explicit partial/failed discovery state rather than inferring coverage.

For each Chat question, compare text-only with fused text/visual retrieval. Include
a text question with an unrelated image, one that an image merely clarifies, and one
requiring a diagram. Confirm `NOT_RELEVANT` visuals are absent, `HELPFUL` visuals
are optional, `REQUIRED` visuals were inspected and cited, and unavailable required
visuals return evidence-limited answers. Verify any later displayed derivative
matches citation asset ID, page, bounds and SHA. Repeat after access revocation,
unlinking, version activation, archive and checksum tampering.

Record detector/description/relevance/pixel-inspection calls, bytes, latency and
provider cost. Confirm no signed URL, image bytes, raw detector output or model
reasoning appears in events, persisted turns, Mongo audits, logs or vectors. A
visual-provider outage must preserve separately grounded text answers and never
widen an authorized vector filter.
