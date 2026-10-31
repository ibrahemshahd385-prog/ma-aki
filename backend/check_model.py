"""يتأكد إن السيرفر بيطلّع نفس أرقام النوت بوك لحالة الاختبار.

التشغيل من فولدر backend:
    .venv\\Scripts\\python check_model.py C:\\Users\\start\\Downloads\\BCMID
"""
import os
import sys

from app.ml import bcmid

root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.expanduser('~'), 'Downloads', 'BCMID')
test = bcmid.card()['self_test']


def read(rel):
    with open(os.path.join(root, *rel.split('/')), 'rb') as f:
        return f.read()


print('حالة الاختبار:', test['case'])
result = bcmid.analyze([read(p) for p in test['mammogram_files']], [read(p) for p in test['ultrasound_files']])
got = {'Mammogram': result['by_modality']['mammogram'], 'Ultrasound': result['by_modality']['ultrasound'],
       'Fusion': result['probability']}
ok = True
for name, expected in test['expected'].items():
    same = abs(got[name] - expected) < 0.01
    ok &= same
    print(f"{name}: السيرفر {got[name]:.4f} | النوت بوك {expected:.4f} | {'✓' if same else '✗'}")
print('\n✅ السيرفر بيطلّع نفس أرقام النوت بوك' if ok else '\n⚠️ فيه فرق، ابعتي الشاشة دي')
