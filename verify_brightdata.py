#!/usr/bin/env python3
import json
import os
import sys
import urllib.error
import urllib.request

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


def main() -> None:
    key = os.environ.get("BRIGHTDATA_API_KEY", "").strip()
    zone = os.environ.get("BRIGHTDATA_ZONE", "search_api").strip() or "search_api"
    if len(sys.argv) > 1:
        key = sys.argv[1].strip()
    if not key:
        print(
            "Usage: BRIGHTDATA_API_KEY=... python verify_brightdata.py\n"
            "   or: python verify_brightdata.py YOUR_API_TOKEN",
            file=sys.stderr,
        )
        sys.exit(1)
    payload = json.dumps(
        {
            "zone": zone,
            "url": "https://www.google.com/search?q=pizza&hl=en",
            "format": "raw",
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://api.brightdata.com/request",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            code = resp.status
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}")
        err = e.read().decode("utf-8", errors="replace")[:1200]
        try:
            data = json.loads(err)
            print(json.dumps(data, indent=2)[:1000])
        except json.JSONDecodeError:
            print(err)
        sys.exit(1)
    except urllib.error.URLError as e:
        print("Request failed:", e.reason or e, file=sys.stderr)
        sys.exit(1)
    print(f"HTTP {code}; response length {len(body)} chars")
    preview = body[:400].replace("\n", " ")
    print("Preview:", preview, "…" if len(body) > 400 else "")


if __name__ == "__main__":
    main()
