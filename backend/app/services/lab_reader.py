"""Claude بيقرا قيم تحاليل الدم من صورة أو PDF التقرير. القراية بس هنا، والمقارنة بالمعدلات في app/labs.py."""
import base64
import io

from .claude import ClaudeUnavailable, create

TOOL = {
    "name": "report_lab_values",
    "description": "Record the blood test values exactly as printed in the lab report.",
    "input_schema": {
        "type": "object",
        "properties": {
            "is_lab_report": {"type": "boolean", "description": "true only if the file is a blood test report"},
            "report_date": {"type": "string", "description": "date printed on the report as YYYY-MM-DD, or empty"},
            "values": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "test": {"type": "string",
                                 "enum": ["hemoglobin", "wbc", "anc", "neutrophils_percent", "platelets", "ca15_3"]},
                        "value": {"type": "number", "description": "the number exactly as printed"},
                        "unit": {"type": "string", "description": "the unit exactly as printed"},
                        "ref_low": {"type": "number", "description": "lower limit of the printed reference range"},
                        "ref_high": {"type": "number", "description": "upper limit of the printed reference range"},
                    },
                    "required": ["test", "value", "unit"],
                },
            },
        },
        "required": ["is_lab_report", "values"],
    },
}

PROMPT = (
    "This file is a patient's lab report. It may be in Arabic or English. Find only these tests if they are printed: "
    "hemoglobin (Hb, HGB), total white blood cells (WBC, TLC), absolute neutrophil count (ANC, neutrophils absolute "
    "count), neutrophils percent, platelets (PLT), and CA 15-3. For each one, copy the value and the unit exactly as "
    "printed, and the reference range printed next to it if there is one (if the report prints separate ranges for "
    "males and females, use the female range). Do not guess, convert, or calculate anything that is not printed. "
    "If the file is not a blood test report, set is_lab_report to false and leave values empty."
)

MAX_SIDE = 1600        # صور الموبايل بتتصغر قبل ما تتبعت


def _file_block(data: bytes, content_type: str):
    if data[:5] == b"%PDF-" or content_type == "application/pdf":
        return {"type": "document",
                "source": {"type": "base64", "media_type": "application/pdf", "data": base64.b64encode(data).decode()}}
    from PIL import Image
    try:
        im = Image.open(io.BytesIO(data))
        im.load()
    except Exception:
        raise ValueError("الملف ده مش صورة ولا PDF. ارفعي صورة التحليل أو ملف PDF.")
    im = im.convert("RGB")
    im.thumbnail((MAX_SIDE, MAX_SIDE))
    out = io.BytesIO()
    im.save(out, format="JPEG", quality=90)
    return {"type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": base64.b64encode(out.getvalue()).decode()}}


def read_lab_report(data: bytes, content_type: str) -> dict:
    """بيرجّع القيم زي ما Claude قراها من التقرير (is_lab_report وreport_date وvalues).

    ValueError لو الملف مش صورة ولا PDF، وClaudeUnavailable لو Claude مش متاح.
    """
    response = create(
        max_tokens=1024,
        tools=[TOOL],
        tool_choice={"type": "tool", "name": TOOL["name"]},
        messages=[{"role": "user", "content": [_file_block(data, content_type), {"type": "text", "text": PROMPT}]}],
    )
    for block in response.content:
        if block.type == "tool_use":
            return dict(block.input)
    raise ClaudeUnavailable(f"Claude didn't fill in the lab values (stop_reason={response.stop_reason}).")
