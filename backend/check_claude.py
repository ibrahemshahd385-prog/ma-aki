"""بيتأكد إن Claude شغال من السيرفر: المفتاح والرصيد والموديل والنت، وبعدين بيقرا تقرير التحليل التجريبي.

شغّليه من فولدر backend (السيرفر شغال أو لأ، مش فارقة):
    .venv\\Scripts\\python check_claude.py
أو بصورة تقرير تانية:
    .venv\\Scripts\\python check_claude.py C:\\path\\to\\report.png

المفتاح نفسه مش بيتطبع.
"""
import logging
import os
import sys

from app.config import ANTHROPIC_API_KEY
from app.labs import evaluate
from app.services.claude import MODEL, ClaudeUnavailable, create
from app.services.lab_reader import read_lab_report

SAMPLE = os.path.join(os.path.expanduser("~"), "Downloads", "maaki_sample_cbc_abnormal.png")


def main():
    print("1) The Claude API key in backend/.env")
    key = ANTHROPIC_API_KEY or ""
    if not key:
        print("   [PROBLEM] ANTHROPIC_API_KEY is not in backend/.env")
        print("   Fix: add this line to backend/.env with your own key, then restart the server:")
        print("        ANTHROPIC_API_KEY=sk-ant-...")
        return 1
    if key != key.strip():
        print("   [PROBLEM] The key has spaces or a new line around it. Remove them in backend/.env.")
        return 1
    if not key.startswith("sk-ant-"):
        print("   [PROBLEM] This doesn't look like a Claude API key (it should start with sk-ant-).")
        return 1
    print("   [OK] found (not shown)")

    print(f"2) A short message to Claude ({MODEL})")
    try:
        create(max_tokens=10, messages=[{"role": "user", "content": "Reply with the word OK."}])
    except ClaudeUnavailable as e:
        print(f"   [PROBLEM] {e.reason}")
        return 1
    print("   [OK] Claude answered")

    path = sys.argv[1] if len(sys.argv) > 1 else SAMPLE
    print("3) Reading a lab report with Claude")
    if not os.path.exists(path):
        print(f"   [SKIPPED] no file at {path}")
    else:
        with open(path, "rb") as f:
            data = f.read()
        try:
            raw = read_lab_report(data, "application/pdf" if path.lower().endswith(".pdf") else "")
        except (ClaudeUnavailable, ValueError) as e:
            print(f"   [PROBLEM] {getattr(e, 'reason', 'not an image or a PDF')}")
            return 1
        result = evaluate(raw)
        for v in result["values"]:
            urgent = "  <- needs the doctor today" if v["severity"] == "red" else ""
            print(f"   {v['test']:<11} {v['value']:>8}  {v['status']}{urgent}")
        print(f"   [OK] read {len(result['values'])} values")

    print()
    print("All good: Wanas and the lab reading can use Claude.")
    return 0


if __name__ == "__main__":
    logging.disable(logging.ERROR)      # الأسباب بتتطبع تحت بشكل أوضح
    try:
        sys.stdout.reconfigure(errors="replace")
    except Exception:
        pass
    sys.exit(main())
