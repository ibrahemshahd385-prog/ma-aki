import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import ALLOWED_ORIGINS
from .routers import ai, clinic, labs, radiology

# رسايل السيرفر (زي سبب فشل Claude) بتظهر في الشاشة السودا اللي شغّالة فيها السيرفر
logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(message)s")
log = logging.getLogger("maaki")


def _warm_up():
    # بنحمّل نموذج الأشعة في الخلفية أول ما السيرفر يقوم، علشان أول تحليل قدام الدكتورة مايستناش دقيقة
    try:
        from .ml import bcmid
        bcmid.warm_up()
        log.info("Scan model is loaded and ready")
    except Exception as e:
        log.warning("Scan model was not loaded at startup (it will load with the first analysis): %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    threading.Thread(target=_warm_up, daemon=True).start()
    yield


app = FastAPI(title="Maaki Backend", version="1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    # أي عنوان محلي على أي port، علشان الواجهة تكلّم السيرفر وانتي بتجربي على الجهاز
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# تضمين مسارات الذكاء الاصطناعي والأشعة والتحاليل والعيادة المشتركة
app.include_router(ai.router)
app.include_router(radiology.router)
app.include_router(labs.router)
app.include_router(clinic.router)

@app.get("/health")
def health_check():
    return {"status": "healthy", "message": "Server is running with AI and Radiology APIs!"}
