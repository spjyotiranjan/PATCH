"""Sign an exact private REST/WS request without displaying the shared secret."""

import argparse
import json
import time
from pathlib import Path
from uuid import UUID, uuid4

import httpx

from patch_ai.api.service_auth import sign_request
from patch_ai.config import Settings


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", help="Exact private route path, for example /v1/questions")
    parser.add_argument("--method", choices=["GET", "POST"], default="GET")
    parser.add_argument("--body-file", type=Path)
    parser.add_argument("--request-id", help="Socket handshake UUID; must match first frame")
    parser.add_argument("--base", help="Override the configured AI host and port")
    parser.add_argument(
        "--send",
        action="store_true",
        help="Send REST request instead of printing short-lived headers",
    )
    args = parser.parse_args()
    if not args.path.startswith("/") or "?" in args.path or "#" in args.path:
        parser.error("Use an exact route path without query parameters")
    body = args.body_file.read_bytes() if args.body_file else b""
    payload = json.loads(body) if body else {}
    request_id = str(UUID(args.request_id or payload.get("requestId") or str(uuid4())))
    if body and (payload.get("requestId") != request_id or payload.get("contractVersion") != "v1"):
        parser.error("Body must contain matching requestId and contractVersion v1")
    settings = Settings()
    host = settings.host
    if host == "0.0.0.0":
        host = "127.0.0.1"
    elif host == "::":
        host = "::1"
    if ":" in host and not host.startswith("["):
        host = f"[{host}]"
    base = args.base or f"http://{host}:{settings.port}"
    secret = settings.ai_service_shared_secret.get_secret_value()
    if len(secret) < 32 or secret.startswith("replace-with-"):
        parser.error("Service authentication is not configured; consult the setup guide")
    timestamp = int(time.time())
    headers = {
        "x-patch-contract-version": "v1",
        "x-patch-request-id": request_id,
        "x-patch-timestamp": str(timestamp),
        "x-patch-signature": sign_request(
            secret=secret,
            request_id=request_id,
            timestamp=timestamp,
            method=args.method,
            path=args.path,
            body=body,
        ),
    }
    if body:
        headers["content-type"] = "application/json"
    if args.send:
        response = httpx.request(
            args.method,
            base.rstrip("/") + args.path,
            content=body or None,
            headers=headers,
            timeout=125,
            follow_redirects=False,
            trust_env=False,
        )
        print(json.dumps({"status": response.status_code, "body": response.json()}, indent=2))
    else:
        # These headers are single-use credentials for only this exact request.
        # Do not publish them or paste them into issue reports.
        print(json.dumps(headers, indent=2))


if __name__ == "__main__":
    main()
