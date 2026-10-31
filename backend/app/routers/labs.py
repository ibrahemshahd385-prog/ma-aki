import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from ..auth import current_user
from ..labs import evaluate
from ..services.claude import ClaudeUnavailable
from ..services.lab_reader import read_lab_report

router = APIRouter(prefix="/api/labs", tags=["Labs"])
log = logging.getLogger(__name__)

MAX_BYTES = 20 * 1024 * 1024
# ورقة التحليل نفسها بتفضل في ملفها والطبيب بيشوفها، فالرسايل هادية ومش بتطلب منها غير إنها تجرب تاني أو تصوّر تاني
NOT_NOW = "مش قادرين نقرا التقرير آليًا دلوقتي. جرّبي تاني بعد شوية."
RETAKE = "صوّري ورقة التحليل كلها في نور كويس، وارفعيها تاني."


@router.post("/read")
async def read_labs(file: UploadFile = File(...), user: dict = Depends(current_user)):
    # Claude بيقرا القيم من التقرير، وبعدين بنقارنها بالمعدلات الطبيعية بقواعد ثابتة. والملف مش بيتحفظ هنا.
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="الملف فاضي")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="الملف كبير قوي (أكبر من 20 MB)")
    try:
        raw = await run_in_threadpool(read_lab_report, data, file.content_type or "")
    except ValueError as e:                 # الملف مش صورة ولا PDF
        raise HTTPException(status_code=422, detail=str(e))
    except ClaudeUnavailable:               # السبب الحقيقي بيتكتب في شاشة السيرفر (وcheck_claude.py بيقوله كمان)
        raise HTTPException(status_code=503, detail=NOT_NOW)
    except Exception:
        log.exception("lab report reading failed")
        raise HTTPException(status_code=503, detail=NOT_NOW)
    result = evaluate(raw)
    if not result["is_lab_report"]:
        raise HTTPException(status_code=422, detail="الصورة دي مش باينة إنها تقرير تحليل دم. " + RETAKE)
    if not result["values"]:
        raise HTTPException(status_code=422, detail="مالقيناش في التقرير صورة دم (CBC) ولا CA 15-3. لو الصورة مش واضحة، " + RETAKE)
    return result
