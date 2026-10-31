import logging

import jwt
from fastapi import Header, HTTPException
from .config import SUPABASE_URL

log = logging.getLogger(__name__)

# أماناً: جلب مفاتيح التوقيع الخاصة بمشروعك في Supabase
jwks = jwt.PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")


def current_user(authorization: str = Header(default="")) -> dict:
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        # الدخول كضيفة من غير Supabase (أو الدخول المباشر للتجربة) مالوش جلسة، فمفيش توكن
        raise HTTPException(
            status_code=401,
            detail="سجّلي دخولك بالإيميل الأول. الدخول كضيفة من غير حساب مش بيفتح خدمات الذكاء الاصطناعي.",
        )
    try:
        key = jwks.get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token,
            key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=f"{SUPABASE_URL}/auth/v1"
        )
    except Exception as e:
        # السبب بيتكتب في شاشة السيرفر بس
        log.warning("JWT verification failed: %s", e)
        raise HTTPException(status_code=401, detail="الجلسة مش صالحة. اخرجي من التطبيق وادخلي تاني بالإيميل.")

    return {
        "id": claims["sub"],
        "email": (claims.get("email") or "").lower().strip(),
        "anonymous": claims.get("is_anonymous", False),
        "token": token
    }
