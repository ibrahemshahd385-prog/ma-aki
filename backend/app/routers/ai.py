from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from ..auth import current_user
from ..services.claude import ClaudeUnavailable, ask_wanes

router = APIRouter(prefix="/api/ai", tags=["AI"])

class PromptRequest(BaseModel):
    prompt: str

@router.post("/wanes")
def chat_with_wanes(req: PromptRequest, user: dict = Depends(current_user)):
    # التأكد من أن المستخدم مسجل الدخول
    try:
        answer = ask_wanes(req.prompt)
    except ClaudeUnavailable:
        # السبب اتكتب في شاشة السيرفر، والواجهة بتعرض الرد المكتوب الجاهز بدل الرسالة دي
        raise HTTPException(status_code=503, detail="ونس مش متاحة دلوقتي. جرّبي تاني بعد شوية، ولو الموضوع عاجل كلّمي طبيبتك.")
    return {"reply": answer}
