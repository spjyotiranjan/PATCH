# Scenario REST and Swagger runbook

This runbook applies the canonical workflows in
[`Backend_Manual_Testing.md`](Backend_Manual_Testing.md) to the cooling-water
booster scenario. Web Swagger at `http://localhost:3000/api/docs` is the primary
surface because Web owns authentication, MongoDB, R2, authorization, product
state, and AI mediation. FastAPI Swagger is for private diagnostics only.

## 1. Start and verify

Start these in separate PowerShell terminals:

```powershell
cd ai
uv run patch-ai
```

```powershell
cd web
npm run dev
```

```powershell
cd web
npm run worker
```

Verify:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod http://localhost:3000/api/readiness
```

The readiness body is aggregate only. It checks the OCR executable/language data,
but a ready result does not prove OCR accuracy, model
entitlement, embedding dimensions, retrieval quality, or source approval.

## 2. Create accounts and authenticate

In same-origin Web Swagger:

1. Create the Owner, Reliability Technician, and Unrelated Technician with
   `POST /api/auth/signup`. Use exactly `name`, `email`, `password`, and
   `confirmPassword`.
2. For each actor, use a separate browser profile or Postman cookie jar.
3. Call `GET /api/auth/csrf`, then form-submit credentials to
   `POST /api/auth/callback/credentials`.
4. Prove login through `GET /api/auth/session`; an HTTP 200 login callback alone
   is not proof of an authenticated session.

Never store credentials or session cookies in this directory.

## 3. Create Equipment and Project

As Owner, copy the three Equipment bodies and Project body from
`00_Scenario_and_Data.md`. Save returned IDs in private local variables:

```text
pumpEquipmentId
driveEquipmentId
transmitterEquipmentId
projectId
```

Before document upload, verify:

- Owner sees all three Equipment records and the Project.
- Project contains the three Equipment IDs without copied Equipment records.
- Project procedures show `WAITING_FOR_SOURCES`.
- Reliability Technician cannot read or mutate the resources yet.
- Unrelated Technician receives the documented safe denial.

Approve Reliability Technician’s Equipment manage-access request only for P-101
and Project membership request. Confirm that this actor can mutate P-101 and read
the Project, but cannot mutate the Project, decide requests, mutate VFD-101, or
gain any third role.

## 4. Calculate every PDF upload value

Run from the repository root:

```powershell
$fixtureRoot = Resolve-Path 'Manual Testing\ui-less-test\pdfs'
Get-ChildItem -LiteralPath $fixtureRoot -Filter *.pdf -File -Recurse |
  Sort-Object FullName |
  ForEach-Object {
    [pscustomobject]@{
      File = $_.Name
      Bytes = $_.Length
      SHA256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
  }
```

Use the exact byte length and lowercase digest for each upload. Do not modify a
PDF after hashing it.

## 5. Upload a new logical document

For each PDF, call `POST /api/documents/upload-sessions` as the authorized Owner.
Example for the Project basis:

```json
{
  "title": "Cooling Water Booster Project Basis and Acceptance",
  "documentType": "PROJECT_DOCUMENT",
  "entity": { "type": "PROJECT", "id": "<projectId>" },
  "contentType": "application/pdf",
  "bytes": 123456,
  "sha256": "<lowercase-sha256>"
}
```

Use the document relationships in `00_Scenario_and_Data.md`. Save each returned
`documentId`, `documentVersionId`, `uploadUrl`, required headers, and expiry in
private Postman/local variables.

Upload the exact file bytes to the returned R2 URL with a separate unauthenticated
binary PUT. Then call:

```text
POST /api/document-versions/{documentVersionId}/complete-upload
Body: {}
```

Poll `GET /api/document-versions/{documentVersionId}`. With the worker running,
the normal state reaches `NEEDS_REVIEW`. A queue is durable; do not repeatedly
create upload sessions when processing is slow.

## 6. Review, approve, index, and activate

For every document:

1. Open `GET /api/document-versions/{versionId}/source` and compare the immutable
   original to extraction pages, source anchors, summary, and quality.
2. Reject any missing page, misleading text order, failed OCR token, or metadata
   error. Do not approve by filename alone.
3. Approve only a reviewed fixture:

```json
{
  "decision": "APPROVE",
  "title": "<reviewed title>",
  "revision": "1",
  "confirmSourceReviewed": true
}
```

4. Poll through `INDEXING`, `INDEXED`, and `ACTIVE`. Activation must never occur
   before approval and successful indexing.
5. Verify direct links and composed Project documents. Equipment sources inherited
   by the Project must resolve the same logical document/version, not a copy.

Expected extraction behavior:

| Document | Expected path |
| --- | --- |
| Project Basis | Native PDF text, quality 1.0 |
| Equipment Register | Native text/tables/diagrams, quality 1.0 |
| Pump Field Guide | Native text and captions, quality 1.0 |
| Multimodal Diagnostic | Native text plus raster-label OCR (0.6 on mixed pages); image-only colour is not interpreted |
| OCR Shift Card | Full-page rendered Tesseract OCR, quality 0.6; compare warning, date/time and measurements |
| DOE/OSHA references | Native text plus OCR where needed; compare originals before approval |

The long official PDFs may expose unsupported or unreadable pages. Treat a typed
extraction failure as a valid safety outcome and record it. Do not bypass the
parser or partially approve a document.

## 7. REST Chat evidence tests

Create a Chat session with `POST /api/chat/sessions` and `{}`. For every question,
use a fresh UUID as `clientTurnId`.

### Direct Project fact

```json
{
  "clientTurnId": "<new-uuid>",
  "question": "What is the target discharge pressure and which instrument supplies feedback?",
  "assignedReferences": [{ "type": "PROJECT", "id": "<projectId>" }]
}
```

Expected: the supported facts cite current approved Project/Equipment sources.
No uncited operational summary is acceptable.

### Equipment-scoped pump question

```json
{
  "clientTurnId": "<new-uuid>",
  "question": "What inspection observations should be recorded for P-101 in this test scenario?",
  "assignedReferences": [{ "type": "EQUIPMENT", "id": "<pumpEquipmentId>" }]
}
```

Expected: only facts supported inside the P-101 scope. Generic DOE evidence may
describe categories, but must not fabricate a site-specific limit.

### OCR question

```json
{
  "clientTurnId": "<new-uuid>",
  "question": "What observation code and discharge pressure are written on the shift inspection card?",
  "assignedReferences": [{ "type": "PROJECT", "id": "<projectId>" }]
}
```

Expected: `CW-17` and `3.1 bar(g)` only if the reviewed OCR text contains both;
the citation must resolve to OCR card page 1.

### Deliberate visual limitation

```json
{
  "clientTurnId": "<new-uuid>",
  "question": "What colour is the anomaly diamond in the control-loop figure?",
  "assignedReferences": [{ "type": "DOCUMENT", "id": "<multimodalDocumentId>" }]
}
```

Expected: no grounded colour claim. `incomplete` is correct because that fact is
present only in pixels. An orange claim is a failure even though a human can see it.

For idempotency, repeat one exact body and confirm the saved turn is returned.
Reuse its UUID with changed content and expect `409 IDEMPOTENCY_CONFLICT`.

## 8. Logs and procedure candidate

Create an Equipment-scoped Project log only after checking the OCR original:

```json
{
  "scopeType": "EQUIPMENT",
  "equipmentId": "<pumpEquipmentId>",
  "text": "Test observation: shift card CW-17 records discharge pressure of 3.1 bar(g). No physical maintenance was performed.",
  "attachmentVersionIds": ["<ocrCardVersionId>"],
  "citations": ["<copy the complete current citation object expected by the schema>"]
}
```

Keep it a draft, update with optimistic revision, then submit only after verifying
the exact schema in Swagger. The AI draft helper may suggest wording but must not
save or submit it.

Once the direct Project basis is active, poll the Project procedure collection.
Inspect the automatically saved candidate, per-step citations, source coverage,
review need, and blockers. Because this pack deliberately lacks an employer-approved
machine-specific isolation procedure, publication may be correctly blocked. Do
not weaken or acknowledge away a severe finding to force a positive result.

## 9. Version propagation test

Create version 2 of `01_Project_Basis_and_Acceptance.pdf` only after making a
controlled fixture revision and updating this pack’s expected facts. While version
2 is pending or failed, version 1 remains active. After approval, indexing, and
activation, every current Project manifest must resolve version 2 and old vectors
must be excluded by current-version filters. The old original remains available
in authorized history.

## 10. Record results

Use `03_Test_Case_Matrix.md`. Record commit/diff, date, tester, safe request IDs,
expected/actual state, and redacted evidence. Never paste credentials, cookies,
signed R2 URLs, raw private prompts/source text, or environment dumps.
