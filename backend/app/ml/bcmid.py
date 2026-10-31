"""نموذج قراية الأشعة (BCMID) جوه السيرفر.

نفس تجهيز الصور ونفس ResNet50 اللي في النوت بوك بالحرف (ب-2 وب-4-ب)، والنموذج نفسه أرقام من ملف npz
اتصدّر من النوت بوك (ب-9-ب). الصور بتتقري من الذاكرة ومش بتتحفظ على السيرفر.
"""
import io
import json
import os
import threading

import numpy as np
from PIL import Image
from scipy import ndimage

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_DIR = os.getenv('MODELS_DIR', os.path.join(BACKEND_DIR, 'models', 'maaki_app_models'))

IMG_SIZE = 224
GRID = 3
BIG = IMG_SIZE * GRID                     # 672 × 672


class ImageError(ValueError):
    """الملف مش صورة نقدر نقراها."""


def open_image(data):
    # صورة عادية (PNG أو JPG)، أو DICOM من جهاز الأشعة
    if len(data) > 132 and data[128:132] == b'DICM':
        try:
            import pydicom
        except ImportError:
            raise ImageError('ملفات DICOM محتاجة مكتبة pydicom في السيرفر. ارفعي الصورة PNG أو JPG.')
        try:
            ds = pydicom.dcmread(io.BytesIO(data))
            return Image.fromarray(ds.pixel_array.astype(np.int32))
        except Exception:
            raise ImageError('مش قادرين نقرا ملف الـ DICOM ده. ارفعي الصورة PNG أو JPG.')
    try:
        im = Image.open(io.BytesIO(data))
        im.load()
        return im
    except Exception:
        raise ImageError('الملف ده مش صورة. ارفعي الأشعة PNG أو JPG أو DICOM.')


# ---------- تجهيز الصور: نفس دوال النوت بوك (الفرق الوحيد إن الدالة الأولى بتاخد صورة مفتوحة) ----------

def to_gray_uint8(im):
    if im.mode in ('I;16', 'I;16B', 'I;16L', 'I', 'F'):          # صور 16-bit
        a = np.asarray(im, dtype=np.float32)
        lo, hi = np.percentile(a, (0.5, 99.5))
        return (np.clip((a - lo) / max(hi - lo, 1e-6), 0, 1) * 255).astype(np.uint8)
    return np.asarray(im.convert('L'))


def square_resize(a, size=IMG_SIZE, align_left=False):
    h, w = a.shape
    s = max(h, w)
    canvas = np.zeros((s, s), dtype=np.uint8)
    top = (s - h) // 2
    left = 0 if align_left else (s - w) // 2
    canvas[top:top + h, left:left + w] = a
    return np.asarray(Image.fromarray(canvas).resize((size, size), Image.Resampling.BILINEAR))


def largest_region_box(a, thr, step, opening, ignore_edges):
    # أكبر منطقة فاتحة في الصورة (على نسخة مصغرة علشان السرعة)
    mask = a[::step, ::step] > thr
    if ignore_edges:                                  # خطوط الإطار على حواف الماموجرام
        mh, mw = max(1, mask.shape[0] // 50), max(1, mask.shape[1] // 50)
        mask[:mh] = False
        mask[-mh:] = False
        mask[:, :mw] = False
        mask[:, -mw:] = False
    mask = ndimage.binary_opening(mask, iterations=opening)
    labels, n = ndimage.label(mask)
    if n == 0:
        return None
    sizes = ndimage.sum(mask, labels, range(1, n + 1))
    ys, xs = np.where(labels == int(np.argmax(sizes)) + 1)
    return ys.min() * step, (ys.max() + 1) * step, xs.min() * step, (xs.max() + 1) * step


def prep_mammogram_big(im):
    # نفس تجهيز الماموجرام بالظبط، بمقاس 672
    a = to_gray_uint8(im)
    k = max(1, a.shape[1] // 20)
    left, right = a[:, :k], a[:, -k:]
    bg_is_left = left.std() < right.std()
    bg_level = float(np.median(left if bg_is_left else right))
    if bg_level > 127:
        a = 255 - a
        bg_level = 255 - bg_level
    if bg_is_left:
        a = a[:, ::-1]
    box = largest_region_box(a, thr=bg_level + 25, step=8, opening=2, ignore_edges=True)
    if box is not None:
        r0, r1, c0, c1 = box
        a = a[r0:r1, c0:c1]
    return square_resize(a, size=BIG, align_left=True)


def prep_ultrasound(im):
    a = to_gray_uint8(im)
    box = largest_region_box(a, thr=12, step=2, opening=3, ignore_edges=False)
    if box is not None:
        r0, r1, c0, c1 = box
        if (r1 - r0) * (c1 - c0) > 0.2 * a.size:      # لو المنطقة صغيرة قوي، سيبي الصورة زي ما هي
            a = a[r0:r1, c0:c1]
    return square_resize(a)


# ---------- النموذج ----------

_lock = threading.Lock()
_state = {}


def _load():
    # بيتحمّل مرة واحدة، أول ما حد يطلب تحليل
    with _lock:
        if 'cnn' not in _state:
            with open(os.path.join(MODELS_DIR, 'bcmid_app_model.json'), encoding='utf-8') as f:
                card = json.load(f)
            with np.load(os.path.join(MODELS_DIR, 'bcmid_heads.npz')) as npz:
                heads = {k: npz[k] for k in npz.files}
            from tensorflow.keras.applications import ResNet50
            from tensorflow.keras.applications.resnet50 import preprocess_input
            cnn = ResNet50(weights='imagenet', include_top=False, pooling='avg', input_shape=(IMG_SIZE, IMG_SIZE, 3))
            _state.update(card=card, heads=heads, cnn=cnn, preprocess_input=preprocess_input)
    return _state


def card():
    return _load()['card']


def _cnn(x):
    s = _load()
    with _lock:                                       # Keras مش بيحب طلبين في نفس الوقت
        return s['cnn'].predict(s['preprocess_input'](x.astype('float32')), verbose=0)


def mammogram_features(im):
    # نفس tile_feature في النوت بوك: 9 مربعات، المربعات اللي فيها نسيج بس، وأقوى إشارة في أي مربع
    g = prep_mammogram_big(im)
    tiles = [g[r:r + IMG_SIZE, c:c + IMG_SIZE] for r in range(0, BIG, IMG_SIZE) for c in range(0, BIG, IMG_SIZE)]
    tiles = [t for t in tiles if (t > 40).mean() > 0.2] or tiles
    return _cnn(np.stack([np.repeat(t[..., None], 3, axis=-1) for t in tiles])).max(axis=0)


def ultrasound_features(im):
    g = prep_ultrasound(im)
    return _cnn(np.repeat(g[..., None], 3, axis=-1)[None])[0]


def head_prob(x, k):
    # نفس الحسبة اللي في النوت بوك: Scaler ثم PCA ثم Logistic Regression، بالأرقام بس
    h = _load()['heads']
    z = (np.asarray(x, dtype=np.float64) - h[f'{k}_scale_mean']) / h[f'{k}_scale_std']
    p = (z - h[f'{k}_pca_mean']) @ h[f'{k}_pca_components'].T
    return float(1 / (1 + np.exp(-(p @ h[f'{k}_coef'] + h[f'{k}_intercept'][0]))))


def analyze(mammograms, ultrasounds):
    """mammograms وultrasounds: قوايم bytes. بيرجّع احتمال إن تقييم الأشعة يبقى BI-RADS 4-6، ومعاه أداء النموذج."""
    c = _load()['card']
    probs = {}
    if mammograms:
        # الحالة = متوسط صورها، فالنتيجة ماتتغيرش بعدد الصور
        probs['Mammogram'] = head_prob(np.mean([mammogram_features(open_image(d)) for d in mammograms], axis=0), 'mammogram')
    if ultrasounds:
        probs['Ultrasound'] = head_prob(np.mean([ultrasound_features(open_image(d)) for d in ultrasounds], axis=0), 'ultrasound')
    if not probs:
        raise ImageError('ارفعي صورة ماموجرام أو سونار الأول.')
    key = 'Fusion' if len(probs) == 2 else next(iter(probs))
    prob = float(np.mean(list(probs.values())))       # الدمج = متوسط الاحتمالات المتاحة
    cv = c['cv_metrics'][key]
    return {
        'probability': round(prob, 4),
        'level': 'high' if prob >= c['threshold'] else 'low',
        'threshold': c['threshold'],
        'by_modality': {k.lower(): round(v, 4) for k, v in probs.items()},
        'images': {'mammogram': len(mammograms), 'ultrasound': len(ultrasounds)},
        'model': {
            'name': c['name'],
            'used': key,
            'predicts': c['predicts'],
            'auc': cv['AUC'][0],
            'auc_sd': cv['AUC'][1],
            'sensitivity': cv['Sensitivity'][0],
            'specificity': cv['Specificity'][0],
            'auc_same_groups': c['within_group_auc']['same_image_count_and_period'][key],
            'cases': c['cases'],
            'data': c['data'],
            'trained_on': c['trained_on'],
        },
        'not_a_diagnosis': c['not_a_diagnosis'],
    }


def warm_up():
    # بيحمّل النموذج ويشغّله مرة على صورة سودا، علشان أول تحليل حقيقي مايستناش التحميل (app/main.py بيناديها)
    _cnn(np.zeros((1, IMG_SIZE, IMG_SIZE, 3), dtype=np.uint8))
