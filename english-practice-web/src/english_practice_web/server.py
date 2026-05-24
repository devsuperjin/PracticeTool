from __future__ import annotations

import uvicorn

from .config import PORT


def main() -> None:
    uvicorn.run("english_practice_web:app", host="0.0.0.0", port=PORT, reload=False)


if __name__ == "__main__":
    main()
