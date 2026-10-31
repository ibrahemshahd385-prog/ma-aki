"""قراية قيم تحاليل الدم ومقارنتها بالمعدلات الطبيعية. قواعد ثابتة من مراجع طبية، مش نموذج متدرّب.

لو التقرير كاتب المعدل الطبيعي بتاعه، بنستخدمه (المعامل بتختلف). ولو مش كاتبه، بنستخدم المعدلات دي:
- الهيموجلوبين وكرات الدم البيضا والصفايح: MedlinePlus (المكتبة الوطنية للطب الأمريكية).
- العدلات: أقل من 1.5 ألف = نقص عدلات (CTCAE v5 من المعهد القومي للسرطان الأمريكي).
- CA 15-3: أقل من 30 U/mL (Mayo Clinic Laboratories). وده للمتابعة بس، مش للتشخيص.
ودرجات الخطورة (أحمر) من CTCAE v5: العدلات أقل من 1.0 ألف، والهيموجلوبين أقل من 8، والصفايح أقل من 50 ألف.
"""

TESTS = {
    'hemoglobin': {'name': 'الهيموجلوبين (Hb)', 'unit': 'g/dL', 'low': 12.0, 'high': 16.0, 'source': 'MedlinePlus'},
    'wbc': {'name': 'كرات الدم البيضا (WBC)', 'unit': '×10⁹/L', 'low': 4.5, 'high': 11.0, 'source': 'MedlinePlus'},
    'anc': {'name': 'العدلات (ANC)', 'unit': '×10⁹/L', 'low': 1.5, 'high': None, 'source': 'CTCAE v5'},
    'platelets': {'name': 'الصفايح (PLT)', 'unit': '×10⁹/L', 'low': 150.0, 'high': 400.0, 'source': 'MedlinePlus'},
    'ca15_3': {'name': 'CA 15-3', 'unit': 'U/mL', 'low': None, 'high': 30.0, 'source': 'Mayo Clinic Laboratories'},
}

SOURCES = {
    'MedlinePlus': 'https://medlineplus.gov/ency/article/003642.htm',
    'CTCAE v5': 'https://dctd.cancer.gov/research/ctep-trials/for-sites/adverse-events/ctcae-v5-8x11.pdf',
    'Mayo Clinic Laboratories': 'https://trinitymuscatine.testcatalog.org/show/LAB776',
}

ORDER = ['hemoglobin', 'wbc', 'anc', 'platelets', 'ca15_3']
RANK = {'ok': 0, 'yellow': 1, 'red': 2}


def _scale(test, value, unit):
    """بيحوّل القيمة لوحدة واحدة لكل تحليل. بيرجّع المعامل اللي اتضربت فيه، علشان نطبقه على المعدل كمان."""
    u = (unit or '').lower().replace(' ', '')
    if test == 'hemoglobin':
        if 'mmol' in u:
            return 1.611                              # mmol/L ← g/dL
        if 'g/l' in u and 'dl' not in u:
            return 0.1                                # g/L ← g/dL
        return 1.0
    if test in ('wbc', 'anc'):
        return 0.001 if value > 300 else 1.0          # خلية/ميكرولتر ← آلاف
    if test == 'platelets':
        return 0.001 if value > 3000 else 1.0
    return 1.0


def evaluate(raw):
    """raw: اللي Claude قراه من التقرير. بيرجّع كل قيمة بوحدة موحدة، وحالتها، ودرجة التنبيه."""
    found = {}
    pct = None
    for item in raw.get('values') or []:
        test = item.get('test')
        try:
            value = float(item.get('value'))
        except (TypeError, ValueError):
            continue
        if test == 'neutrophils_percent':
            pct = value
            continue
        if test not in TESTS or test in found:
            continue
        k = _scale(test, value, item.get('unit'))
        lo, hi = item.get('ref_low'), item.get('ref_high')
        from_report = isinstance(lo, (int, float)) or isinstance(hi, (int, float))
        found[test] = {
            'value': round(value * k, 2),
            'low': round(lo * k, 2) if isinstance(lo, (int, float)) else (None if from_report else TESTS[test]['low']),
            'high': round(hi * k, 2) if isinstance(hi, (int, float)) else (None if from_report else TESTS[test]['high']),
            'range_from': 'report' if from_report else 'default',
            'as_written': f"{item.get('value')} {item.get('unit') or ''}".strip(),
        }
    # لو التقرير كاتب نسبة العدلات بس، بنحسب العدد من كرات الدم البيضا
    if 'anc' not in found and pct is not None and 'wbc' in found:
        found['anc'] = {'value': round(found['wbc']['value'] * pct / 100, 2), 'low': TESTS['anc']['low'], 'high': None,
                        'range_from': 'default', 'as_written': f'{pct}% من كرات الدم البيضا'}

    values = []
    for test in ORDER:
        if test not in found:
            continue
        f = found[test]
        v, lo, hi = f['value'], f['low'], f['high']
        status = 'low' if lo is not None and v < lo else 'high' if hi is not None and v > hi else 'normal'
        severity, note = ('ok', '')
        if test == 'anc' and v < 1.0:
            severity, note = 'red', 'نقص شديد في العدلات. لو عندك حرارة 38 أو أكتر، كلّمي طبيبتك أو روحي الطوارئ فورًا.'
        elif test == 'hemoglobin' and v < 8.0:
            severity, note = 'red', 'الهيموجلوبين واطي جدًا. كلّمي طبيبتك النهارده.'
        elif test == 'platelets' and v < 50:
            severity, note = 'red', 'الصفايح واطية جدًا. كلّمي طبيبتك النهارده، وخدي بالك من أي نزيف.'
        elif status != 'normal':
            severity = 'yellow'
            note = ('ارتفاعه لوحده مش تشخيص. الطبيبة بتقارنه بالقيم اللي قبله.' if test == 'ca15_3'
                    else 'برا المعدل الطبيعي. اعرضيه على طبيبتك في المتابعة.')
        values.append({'test': test, 'name': TESTS[test]['name'], 'unit': TESTS[test]['unit'], **f,
                       'status': status, 'severity': severity, 'note': note,
                       'source': 'التقرير نفسه' if f['range_from'] == 'report' else TESTS[test]['source']})

    overall = max((v['severity'] for v in values), key=RANK.get, default='ok')
    return {
        'is_lab_report': bool(raw.get('is_lab_report')),
        'report_date': raw.get('report_date') or None,
        'values': values,
        'severity': overall,
        'sources': SOURCES,
        'disclaimer': 'القيم دي اتقرت آليًا من صورة التقرير، فراجعيها على الورقة. والمقارنة بالمعدل الطبيعي مش تشخيص، '
                      'والقرار مع طبيبتك.',
    }
