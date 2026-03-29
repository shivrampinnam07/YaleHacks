from __future__ import annotations

import base64
import io

from groq import Groq
from PIL import Image

from yalehacks.config import get_groq_key, get_groq_vision_model


def _prepare_image(data: bytes) -> str:
    im = Image.open(io.BytesIO(data))
    if im.mode != "RGB":
        im = im.convert("RGB")
    max_side = 2048
    w, h = im.size
    if max(w, h) > max_side:
        scale = max_side / max(w, h)
        im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=88)
    b64 = base64.standard_b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def read_tag_text(image_bytes: bytes) -> str:
    data_url = _prepare_image(image_bytes)
    client = Groq(api_key=get_groq_key())
    model = get_groq_vision_model()
    system = (
        "You read clothing care and composition labels. Transcribe every visible word. "
        "Preserve fiber names and percentages exactly. If text is unreadable, say so briefly."
    )
    user = (
        "Transcribe all text on this garment tag (materials, percentages, care symbols legend if visible). "
        "Output plain text only, one line per logical line on the tag."
    )
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ],
        temperature=0.2,
        max_tokens=2048,
    )
    choice = resp.choices[0].message
    text = (choice.content or "").strip()
    if not text:
        raise RuntimeError("Vision model returned empty text")
    return text
