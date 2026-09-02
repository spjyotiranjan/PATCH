import json
from pathlib import Path

from patch_ai.main import app

OUTPUT_PATH = Path(__file__).resolve().parents[1] / "openapi.json"


def main() -> None:
    OUTPUT_PATH.write_text(
        json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
