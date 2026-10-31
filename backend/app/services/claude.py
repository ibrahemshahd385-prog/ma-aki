"""الكلام مع Claude: ونس، وقراية تقارير التحاليل (services/lab_reader.py).

لو Claude مش متاح (المفتاح، أو الرصيد، أو النت)، بنرمي ClaudeUnavailable ومعاه السبب الحقيقي بالإنجليزي.
السبب بيتكتب في شاشة السيرفر وفي check_claude.py، والمريضة بتشوف رسالة عربي بسيطة، والتطبيق بيكمّل من غيره:
ونس بترد بالردود المكتوبة، والتحاليل بتتكتب بالإيد.
"""
import logging
import os

import anthropic
from ..config import ANTHROPIC_API_KEY

log = logging.getLogger(__name__)

# الموديل القديم (claude-3-5-sonnet-20241022) اتشال من الخدمة. وممكن يتغير من backend/.env بـ CLAUDE_MODEL
MODEL = os.getenv("CLAUDE_MODEL") or "claude-sonnet-5-5"

SYSTEM = (
    "أنتِ «ونس» رفيقة مريضات سرطان الثدي في تطبيق معاكِ. دوركِ تقديم الدعم النفسي والإجابة بلطف واحترافية عالية "
    "مع الالتزام بالدقة الطبية المبسطة. "
    "لا تشخّصين ولا تغيّرين علاجاً أو جرعات، وأي سؤال عن قرار علاجي تحوّلينه للطبيبة المتابعة. "
    "وإذا ذكرت المريضة عرضاً خطيراً (حرارة عالية أثناء العلاج الكيماوي، أو ضيق تنفّس، أو نزيف، أو أفكار بإيذاء نفسها) "
    "فاطلبي منها التواصل مع طبيبتها أو الطوارئ فوراً."
)


class ClaudeUnavailable(Exception):
    """Claude مش قادر يرد دلوقتي. reason: السبب الحقيقي وإزاي يتصلح (للمطوّرة، مش للمريضة)."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def why(e: Exception) -> str:
    """بيترجم خطأ Claude لسبب واضح وإزاي يتصلح."""
    if not ANTHROPIC_API_KEY:
        return "ANTHROPIC_API_KEY is missing from backend/.env. Add it there, then restart the server."
    text = str(e).lower()
    status = getattr(e, "status_code", None)
    if getattr(e, "type", None) == "billing_error" or "credit balance" in text or "billing" in text:
        return "The Claude account has no credit left. Add credit at console.anthropic.com (Billing), then try again."
    if isinstance(e, anthropic.AuthenticationError):
        return ("The ANTHROPIC_API_KEY in backend/.env is not valid (wrong, disabled or deleted). Make a new key at "
                "console.anthropic.com (API keys), put it in backend/.env and restart the server.")
    if isinstance(e, anthropic.PermissionDeniedError):
        return f"This API key is not allowed to use {MODEL}. Check the key's workspace at console.anthropic.com."
    if isinstance(e, anthropic.NotFoundError):
        return f"The model {MODEL} was not found for this API key. Set CLAUDE_MODEL in backend/.env to a model it has."
    if isinstance(e, anthropic.RateLimitError):
        return "Too many requests to Claude right now (rate limit). Wait a minute and try again."
    if isinstance(e, anthropic.APITimeoutError):
        return "Claude took too long to answer (timeout). Check the internet connection and try again."
    if isinstance(e, anthropic.APIConnectionError):
        return "The server can't reach api.anthropic.com. Check the internet connection (and any VPN or firewall)."
    if isinstance(e, anthropic.APIStatusError) and status and status >= 500:
        return f"Claude's service is busy or down right now ({status}). Try again in a few minutes."
    if isinstance(e, anthropic.APIStatusError):
        return f"Claude refused the request ({status}): {e}"
    return f"{type(e).__name__}: {e}"


_client = None


def _get_client():
    global _client
    if _client is None:
        # لو النت قطع لحظة أو الخدمة عليها ضغط، المكتبة بتعيد الطلب لوحدها مرتين، ومش بتستنى أكتر من 45 ثانية
        _client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY, max_retries=2, timeout=45.0)
    return _client


def create(**kwargs):
    """طلب لـ Claude بالموديل بتاعنا. لو فشل لأي سبب، بيرمي ClaudeUnavailable ومعاه السبب."""
    try:
        if not ANTHROPIC_API_KEY:
            raise RuntimeError("no API key")
        return _get_client().messages.create(model=MODEL, **kwargs)
    except Exception as e:
        reason = why(e)
        log.error("Claude unavailable: %s", reason)
        raise ClaudeUnavailable(reason) from e


def ask_wanes(prompt: str) -> str:
    response = create(max_tokens=1000, system=SYSTEM, messages=[{"role": "user", "content": prompt}])
    answer = "".join(block.text for block in response.content if block.type == "text").strip()
    if not answer:
        raise ClaudeUnavailable(f"Claude sent an empty answer (stop_reason={response.stop_reason}).")
    return answer
