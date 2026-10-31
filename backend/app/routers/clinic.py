import json
import logging
import re
import threading
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import quote
from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel

from ..auth import current_user

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/clinic", tags=["Clinic"])

STORE_FILE = Path(__file__).resolve().parent.parent.parent / "uploads" / "clinic_store.json"

DEFAULT_DOCTORS: Dict[str, Dict[str, Any]] = {
    "d_main": {
        "id": "d_main",
        "name": "د. سارة عادل",
        "specialty": "جراحة وأورام الثدي",
        "hospital": "عيادة تجريبية",
        "code": "MK-4821",
        "hours": {"from": 10, "to": 16},
        "phone": "",
        "verified": True,
        "syndicateNo": "[رقم القيد]",
        "demo": True,
    },
    "d_1937": {
        "id": "d_1937",
        "name": "د. مريم محمود",
        "specialty": "جراحة وأورام الثدي",
        "hospital": "عيادة خاصة",
        "code": "MK-1937",
        "hours": {"from": 10, "to": 16},
        "phone": "01012345678",
        "verified": True,
        "syndicateNo": "148290",
        "demo": False,
    },
    "d_4539": {
        "id": "d_4539",
        "name": "د. أحمد كمال",
        "specialty": "جراحة وأورام الثدي",
        "hospital": "عيادة خاصة",
        "code": "MK-4539",
        "hours": {"from": 10, "to": 16},
        "phone": "01012345678",
        "verified": True,
        "syndicateNo": "145390",
        "demo": False,
    },
}

TABLE_NAMES = ["doctors", "patients", "messages", "symptoms", "labs", "notes", "access", "alerts", "medlogs"]
CHILD_TABLES = ["messages", "symptoms", "labs", "notes", "access", "alerts", "medlogs"]
DEMO_DOCTOR_EMAILS = {"doctor@clinic.com", "demo@doctor.com"}   # نفس frontend/src/store/auth.ts (doctorIdOf)

_lock = threading.Lock()


def _clean_code(c: str) -> str:
    if not c:
        return ""
    # Convert Arabic-Indic digits to ASCII
    arabic_digits = "٠١٢٣٤٥٦٧٨٩"
    ascii_digits = "0123456789"
    trans = str.maketrans({ord(a): ord(e) for a, e in zip(arabic_digits, ascii_digits)})
    c = c.translate(trans)
    return re.sub(r"[^A-Za-z0-9]", "", c).upper()


def _load_store() -> Dict[str, Any]:
    store: Dict[str, Any] = {t: {} for t in TABLE_NAMES}
    store["doctors"] = {**DEFAULT_DOCTORS}
    if STORE_FILE.exists():
        try:
            with open(STORE_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                for t in TABLE_NAMES:
                    if t in saved and isinstance(saved[t], dict):
                        store[t].update(saved[t])
        except Exception as e:
            log.warning("Could not read clinic store: %s", e)
    return store


def _save_store(store: Dict[str, Any]):
    try:
        STORE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(STORE_FILE, "w", encoding="utf-8") as f:
            json.dump(store, f, ensure_ascii=False, indent=2)
    except Exception as e:
        log.warning("Could not save clinic store: %s", e)


_MEMORY_STORE = _load_store()


# ---------- مين يشوف إيه ----------
# كل الطلبات هنا محتاجة دخول حقيقي (توكن Supabase). المريضة بتشوف ملفها بس، والدكتور بيشوف المريضات اللي
# بعتوله طلب ربط (doctorId بتاعهم = الدكتور ده) بس. ومن غير دخول مفيش أي بيانات، حتى من اللينك العام.

def _sid(email: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (email or "").lower().strip())


def _me(user: dict):
    """الإيميل، ورقم ملفها كمريضة، ورقم الدكتور لو الحساب ده دكتور (نفس الأرقام اللي بيعملها التطبيق)."""
    email = (user.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=401, detail="سجّلي دخولك بالإيميل الأول.")
    pid = "p_" + _sid(email)
    did = None
    for d in _MEMORY_STORE.get("doctors", {}).values():
        if (d.get("email") or "").lower().strip() == email:
            did = d.get("id")
            break
    if not did:
        did = "d_main" if email in DEMO_DOCTOR_EMAILS else "d_" + _sid(email)
    return email, pid, did


def _allowed_pids(pid: str, did: str) -> set:
    """ملفها هي، والمريضات اللي اختاروا الدكتور ده."""
    out = {pid}
    for p in _MEMORY_STORE.get("patients", {}).values():
        if p.get("doctorId") == did and p.get("id"):
            out.add(p["id"])
    return out


def _public_doctor(d: Dict[str, Any], did: str) -> Dict[str, Any]:
    # إيميل الدكتور مايظهرش لغيره
    return d if d.get("id") == did else {k: v for k, v in d.items() if k != "email"}


def _forbidden():
    raise HTTPException(status_code=403, detail="مش مسموح تعدّلي البيانات دي.")


def _check_code_free(code: str, doctor_id: str):
    """كود الربط مايتكررش: لو طبيب تاني عنده نفس الكود، الحفظ بيترفض."""
    want = _clean_code(code)
    if not want:
        raise HTTPException(status_code=400, detail="كود الربط ناقص.")
    for other in _MEMORY_STORE.get("doctors", {}).values():
        if other.get("id") != doctor_id and _clean_code(other.get("code", "")) == want:
            raise HTTPException(status_code=409, detail="الكود ده مستخدم لطبيب تاني. اطلب كود جديد.")


@router.get("/doctors")
def get_all_doctors(user: dict = Depends(current_user)):
    """Returns all registered and seeded doctors (without the others' emails)."""
    _, _, did = _me(user)
    return {k: _public_doctor(d, did) for k, d in _MEMORY_STORE.get("doctors", {}).items()}


@router.get("/doctors/generate-code")
def generate_code(user: dict = Depends(current_user)):
    """Generates a unique doctor code like MK-XXXX not yet taken by any doctor."""
    import random
    existing_codes = {
        _clean_code(d.get("code", ""))
        for d in _MEMORY_STORE.get("doctors", {}).values()
    }
    for _ in range(500):
        num = random.randint(1000, 9999)
        code = f"MK-{num}"
        if _clean_code(code) not in existing_codes:
            return {"code": code}
    num = random.randint(10000, 99999)
    return {"code": f"MK-{num}"}


@router.get("/doctors/by-email/{email:path}")
def get_doctor_by_email(email: str, user: dict = Depends(current_user)):
    """Finds the signed-in doctor's own profile by email."""
    clean_email = email.lower().strip()
    if clean_email != _me(user)[0]:
        raise HTTPException(status_code=403, detail="ده مش حسابك.")
    doctors = _MEMORY_STORE.get("doctors", {})
    for doc in doctors.values():
        if doc.get("email") and doc["email"].lower().strip() == clean_email:
            return doc
    raise HTTPException(status_code=404, detail="Doctor not found by email")


@router.get("/patients/by-email/{email:path}")
def get_patient_by_email(email: str, user: dict = Depends(current_user)):
    """Finds the signed-in patient's own record and related data by email address."""
    clean_email = email.lower().strip()
    if clean_email != _me(user)[0]:
        raise HTTPException(status_code=403, detail="ده مش حسابك.")
    pid = "p_" + re.sub(r"[^a-z0-9]+", "_", clean_email)
    patients = _MEMORY_STORE.get("patients", {})
    patient = patients.get(pid)
    if not patient:
        for p in patients.values():
            if p.get("email") and p["email"].lower().strip() == clean_email:
                patient = p
                pid = p.get("id")
                break
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found by email")

    return {
        "patient": patient,
        "symptoms": [r for r in _MEMORY_STORE.get("symptoms", {}).values() if r.get("pid") == pid],
        "labs": [r for r in _MEMORY_STORE.get("labs", {}).values() if r.get("pid") == pid],
        "notes": [r for r in _MEMORY_STORE.get("notes", {}).values() if r.get("pid") == pid],
        "messages": [r for r in _MEMORY_STORE.get("messages", {}).values() if r.get("pid") == pid],
        "alerts": [r for r in _MEMORY_STORE.get("alerts", {}).values() if r.get("pid") == pid],
        "medlogs": [r for r in _MEMORY_STORE.get("medlogs", {}).values() if r.get("pid") == pid],
        "access": [r for r in _MEMORY_STORE.get("access", {}).values() if r.get("pid") == pid],
    }


@router.get("/doctors/{code}")
def get_doctor_by_code(code: str, user: dict = Depends(current_user)):
    """Finds doctor by code regardless of dashes, spaces or case."""
    want = _clean_code(code)
    if not want:
        raise HTTPException(status_code=400, detail="Invalid doctor code")

    _, _, did = _me(user)
    doctors = _MEMORY_STORE.get("doctors", {})
    for doc in doctors.values():
        if _clean_code(doc.get("code", "")) == want:
            return _public_doctor(doc, did)

    raise HTTPException(status_code=404, detail="Doctor not found")


class DoctorPayload(BaseModel):
    id: str
    name: str
    specialty: str = "جراحة وأورام الثدي"
    hospital: str = "عيادة خاصة"
    code: str
    hours: Optional[Dict[str, int]] = None
    phone: Optional[str] = ""
    verified: Optional[bool] = True
    syndicateNo: Optional[str] = ""
    demo: Optional[bool] = False
    email: Optional[str] = None


@router.post("/doctors")
def save_doctor(doc: DoctorPayload, user: dict = Depends(current_user)):
    """Saves or updates the signed-in doctor's own profile."""
    email, _, did = _me(user)
    if doc.id != did:
        _forbidden()
    doc_dict = doc.model_dump()
    doc_dict["email"] = email
    with _lock:
        _check_code_free(doc.code, doc.id)
        _MEMORY_STORE.setdefault("doctors", {})[doc.id] = doc_dict
        _save_store(_MEMORY_STORE)
    return {"status": "ok", "doctor": doc_dict}


@router.get("/tables")
def get_tables(user: dict = Depends(current_user)):
    """The rows this account may see: her own file, or the doctor's patients, and the doctors list."""
    _, pid, did = _me(user)
    allowed = _allowed_pids(pid, did)
    out: Dict[str, Any] = {t: {} for t in TABLE_NAMES}
    out["doctors"] = {k: _public_doctor(d, did) for k, d in _MEMORY_STORE.get("doctors", {}).items()}
    out["patients"] = {k: p for k, p in _MEMORY_STORE.get("patients", {}).items() if k in allowed}
    for t in CHILD_TABLES:
        out[t] = {k: r for k, r in _MEMORY_STORE.get(t, {}).items() if r.get("pid") in allowed}
    return out


class SyncPayload(BaseModel):
    action: str  # put, add, update, remove
    table: str
    id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    patch: Optional[Dict[str, Any]] = None


@router.post("/sync")
def sync_mutation(payload: SyncPayload, user: dict = Depends(current_user)):
    """A change from the app. The patient changes her own file; the doctor changes his patients' files."""
    table = payload.table
    if table not in TABLE_NAMES:
        raise HTTPException(status_code=400, detail="Unknown table")

    _, pid, did = _me(user)
    with _lock:
        allowed = _allowed_pids(pid, did)
        t_store = _MEMORY_STORE.setdefault(table, {})
        row_id = (payload.data or {}).get("id") or payload.id
        old = t_store.get(row_id) if row_id else None

        if table == "doctors":
            if row_id != did:                                   # his own profile only
                _forbidden()
            new_code = (payload.data or {}).get("code") if payload.action in ("add", "put") else (payload.patch or {}).get("code")
            if new_code is not None:
                _check_code_free(str(new_code), row_id)          # a code nobody else has
        elif table == "patients":
            # her own file, or (for the doctor) a patient who chose him
            if row_id != pid and not (old and old.get("doctorId") == did):
                _forbidden()
        else:
            new_pid = (payload.data or {}).get("pid")
            if old is not None and old.get("pid") not in allowed:
                _forbidden()
            if payload.action in ("add", "put") and new_pid not in allowed:
                _forbidden()

        if payload.action in ("add", "put") and payload.data:
            if row_id:
                t_store[row_id] = payload.data
        elif payload.action == "update" and payload.id:
            if payload.id in t_store and payload.patch:
                t_store[payload.id].update(payload.patch)
        elif payload.action == "remove" and payload.id:
            t_store.pop(payload.id, None)

        _save_store(_MEMORY_STORE)
    return {"status": "ok"}


# ---------- الملفات اللي المريضة بترفعها ----------
# الأشعة والتقارير بتتحفظ هنا على السيرفر، علشان الدكتور يفتحها من أي جهاز (مش بس من نفس المتصفح).
# المريضة بس هي اللي ترفع وتمسح ملفاتها، والدكتور بيفتح ملفات المريضات اللي اختاروه بس.

FILES_DIR = STORE_FILE.parent / "files"
FILE_TESTS = {"mammo", "us", "bio", "lab"}
MAX_FILE_BYTES = 40 * 1024 * 1024   # نفس الحد اللي في التطبيق (Tests.tsx)


def _file_paths(pid: str, test: str):
    if test not in FILE_TESTS or not re.fullmatch(r"p_[a-z0-9_]+", pid or ""):
        raise HTTPException(status_code=400, detail="ملف مش معروف.")
    folder = FILES_DIR / pid
    return folder / test, folder / (test + ".json")


@router.put("/files/{pid}/{test}")
async def save_file(pid: str, test: str, file: UploadFile = File(...), at: str = Form(""), user: dict = Depends(current_user)):
    """المريضة بترفع ملف من فحوصاتها."""
    _, my_pid, _ = _me(user)
    if pid != my_pid:
        _forbidden()
    blob_path, meta_path = _file_paths(pid, test)
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="الملف فاضي")
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="الملف كبير قوي (أكبر من 40 ميجا)")
    blob_path.parent.mkdir(parents=True, exist_ok=True)
    blob_path.write_bytes(data)
    meta = {"name": file.filename or test, "type": file.content_type or "", "size": len(data), "at": at}
    meta_path.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    return {"status": "ok"}


@router.get("/files/{pid}/{test}")
def read_file(pid: str, test: str, user: dict = Depends(current_user)):
    """الملف نفسه: للمريضة نفسها، وللدكتور اللي هي اختارته."""
    _, my_pid, did = _me(user)
    if pid not in _allowed_pids(my_pid, did):
        _forbidden()
    blob_path, meta_path = _file_paths(pid, test)
    if not blob_path.exists():
        raise HTTPException(status_code=404, detail="الملف مش موجود على السيرفر")
    meta = {}
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception:
            meta = {}
    headers = {"X-File-Name": quote(meta.get("name") or test), "X-File-At": quote(meta.get("at") or "")}
    return Response(content=blob_path.read_bytes(), media_type=meta.get("type") or "application/octet-stream", headers=headers)


@router.delete("/files/{pid}/{test}")
def remove_file(pid: str, test: str, user: dict = Depends(current_user)):
    """المريضة بتشيل ملف."""
    _, my_pid, _ = _me(user)
    if pid != my_pid:
        _forbidden()
    for path in _file_paths(pid, test):
        if path.exists():
            path.unlink()
    return {"status": "ok"}

