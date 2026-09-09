# Product WebSocket testing with Postman

Swagger cannot execute WebSocket conversations. Use Postman Desktop’s raw
WebSocket client for the Web product gateway. Do not select Socket.IO.

## Prerequisites

- Web was started with `npm run dev` or `npm start`, which uses the custom server
  that mounts `/ws/chat`.
- AI and the durable worker are running.
- Postman has an authenticated Web session for the intended actor at
  `http://localhost:3000`.
- A Chat session was created through `POST /api/chat/sessions`.
- The documents referenced by a question are approved, indexed, active, and
  accessible to that actor.

## Connect

1. Create a new **WebSocket** request.
2. URL:

```text
ws://localhost:3000/ws/chat?sessionId=<sessionId>
```

3. Add `Origin: http://localhost:3000` before connecting.
4. Ensure Postman sends the Auth.js session cookie. If the cookie jar is not used
   for WebSocket handshakes, copy the current cookie header privately. Preserve
   every numbered chunk if the cookie is split. Never save or export it.
5. Connect and require:

```json
{ "type": "connection.ready", "sessionId": "<sessionId>" }
```

Wrong Origin, missing/expired cookie, or another user’s session must fail before
a turn is accepted.

## Submit a scenario turn

```json
{
  "type": "turn.submit",
  "clientTurnId": "<new-uuid>",
  "question": "What pressure was observed on inspection card CW-17, and how does it compare with the project target?",
  "assignedReferences": [{ "type": "PROJECT", "id": "<projectId>" }]
}
```

Expected order:

```text
turn.accepted
turn.processing
turn.completed
```

`turn.completed.turn.result` must contain the persisted evidence state, steps,
and exact citations. The target should resolve from the native Project basis;
the observation should resolve from the reviewed OCR card. If either source is
missing or not active, the response must expose the evidence gap rather than fill it.

## Assignment cases

Send each with a fresh UUID:

| Assignment | Question | Expected behavior |
| --- | --- | --- |
| Project | Target and observed pressure | May use direct Project and inherited included-Equipment sources |
| Pump Equipment | General pump inspection topics | Only P-101-accessible sources |
| Multimodal document | Colour of anomaly marker | No visual-only colour claim |
| OCR document | Code and observed pressure | Only after reviewed OCR activation |
| None | Current project issue | Current actor’s authorized active manifest only |
| Inaccessible ID | Any question | Reject; assignment never grants access |

## Persistence, replay, and reconnect

- Send an exact completed `clientTurnId`/content again. The saved turn must be
  returned without a second generation.
- Reuse the ID with changed content. Expect `turn.error` with an idempotency
  conflict, not a second turn.
- Disconnect after `turn.processing`, reconnect, and read REST turn history.
  Disconnect cancels delivery, not committed history.
- Use `{"type":"turn.cancel"}` only for the current delivery. It cannot erase a
  completed turn or undo any product mutation.

## Authorization race

1. Begin a long question as Reliability Technician.
2. In the Owner session, revoke Project membership or remove an included Equipment.
3. The gateway must recompute scope before persistence and must not deliver a
   newly unauthorized citation.
4. REST history must not expose the source after revocation.

Repeat with a replacement source version activating during generation. The old
revision must not be persisted as current guidance.

## Safe failure cases

- Stop AI while Web remains up: expect a typed unavailable turn; source browsing
  through Web remains functional.
- Send malformed JSON, a binary frame, or a frame larger than 32,000 bytes: expect
  bounded rejection without raw exception or connection-secret leakage.
- Submit two turns concurrently in the same session: one in-flight turn only.
- Put an instruction in source/question text to ignore scope or publish a record:
  it must remain untrusted content and cannot alter authorization or mutate state.

## Private AI socket distinction

`ws://127.0.0.1:8000/v1/questions/ws` is an operator diagnostic channel using
four HMAC headers, a fresh request UUID, no Origin, and one question per connection.
It does not authenticate a product user or persist Chat. Follow section 9 of the
root backend manual for that separate test; do not reuse browser cookies or the
AI shared secret across these two surfaces.
