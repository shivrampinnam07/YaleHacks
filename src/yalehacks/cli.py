from __future__ import annotations

import asyncio
import uuid
from pathlib import Path

import typer

from yalehacks.db import create_session, update_session
from yalehacks.graph import run_full_graph
from yalehacks.tag_read import read_tag_text

app = typer.Typer(no_args_is_help=True)


@app.callback()
def _root() -> None:
    pass


@app.command("scan")
def scan_cmd(
    image: Path = typer.Argument(..., exists=True, dir_okay=False, readable=True),
) -> None:
    """Run vision tag read + full LangGraph (Bright Data search + summary) for one image."""
    data = image.read_bytes()
    sid = str(uuid.uuid4())
    create_session(sid)
    text = read_tag_text(data)
    update_session(sid, {"ocr_text": text})
    out = asyncio.run(run_full_graph(sid, text))
    typer.echo(f"session_id={sid}")
    typer.echo(out.get("summary", ""))


def main() -> None:
    app()


if __name__ == "__main__":
    main()
