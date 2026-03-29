import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


@lru_cache
def get_mongodb_uri() -> str:
    return os.environ.get("MONGODB_URI", "").strip()


@lru_cache
def get_brightdata_api_key() -> str:
    v = os.environ.get("BRIGHTDATA_API_KEY", "").strip()
    if not v:
        raise RuntimeError("Set BRIGHTDATA_API_KEY in the environment or .env")
    return v


def get_brightdata_zone() -> str:
    return os.environ.get("BRIGHTDATA_ZONE", "search_api").strip() or "search_api"


@lru_cache
def get_groq_key() -> str:
    v = os.environ.get("GROQ_API_KEY", "").strip()
    if not v:
        raise RuntimeError("Set GROQ_API_KEY in the environment or .env")
    return v


def get_groq_vision_model() -> str:
    return os.environ.get(
        "GROQ_VISION_MODEL",
        "meta-llama/llama-4-scout-17b-16e-instruct",
    ).strip()


def get_groq_summary_model() -> str:
    return os.environ.get("GROQ_SUMMARY_MODEL", "openai/gpt-oss-20b").strip()


def get_cors_origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", "*").strip()
    if raw == "*":
        return ["*"]
    return [o.strip() for o in raw.split(",") if o.strip()]
