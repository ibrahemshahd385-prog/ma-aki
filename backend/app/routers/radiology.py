from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from ..auth import current_user

router = APIRouter(prefix="/api/radiology", tags=["Radiology"])

MAX_FILES = 8
MAX_BYTES = 60 * 1024 * 1024        # صورة الماموجرام الأصلية ممكن توصل لحوالي 20 MB
NOT_INSTALLED = "مكتبات نموذج الأشعة مش متسطبة في السيرفر: pip install -r requirements.txt"
NO_FILES = "ملفات النموذج مش موجودة في السيرفر (backend/models/maaki_app_models)"


def _model():
    # النموذج بيتحمّل وقت الطلب بس، فباقي السيرفر (ونس مثلًا) بيشتغل حتى لو مكتباته مش متسطبة
    try:
        from ..ml import bcmid
    except ImportError:
        raise HTTPException(status_code=503, detail=NOT_INSTALLED)
    return bcmid


async def _read_all(files: List[UploadFile]) -> List[bytes]:
    out = []
    for f in files:
        data = await f.read()
        if not data:
            raise HTTPException(status_code=400, detail="فيه ملف فاضي")
        if len(data) > MAX_BYTES:
            raise HTTPException(status_code=413, detail="الملف كبير قوي (أكبر من 60 MB)")
        out.append(data)
    return out


@router.post("/analyze")
async def analyze_scan(
    mammogram: List[UploadFile] = File(default=[]),
    ultrasound: List[UploadFile] = File(default=[]),
    user: dict = Depends(current_user),
):
    # الصور بتتحلل من الذاكرة ومش بتتحفظ على السيرفر (بيانات صحية)
    if not mammogram and not ultrasound:
        raise HTTPException(status_code=400, detail="ارفعي صورة ماموجرام أو سونار الأول")
    if len(mammogram) + len(ultrasound) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"أقصى عدد {MAX_FILES} صور في المرة")
    bcmid = _model()
    mammo_bytes = await _read_all(mammogram)
    us_bytes = await _read_all(ultrasound)
    try:
        return await run_in_threadpool(bcmid.analyze, mammo_bytes, us_bytes)
    except bcmid.ImageError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail=NO_FILES)
    except ImportError:
        raise HTTPException(status_code=503, detail=NOT_INSTALLED)


@router.get("/model")
async def model_card(user: dict = Depends(current_user)):
    # بطاقة النموذج: بيتنبأ بإيه، وأداؤه، وحدوده. وأول طلب بيحمّل النموذج (بيفيد قبل العرض)
    bcmid = _model()
    try:
        return await run_in_threadpool(bcmid.card)
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail=NO_FILES)
    except ImportError:
        raise HTTPException(status_code=503, detail=NOT_INSTALLED)
