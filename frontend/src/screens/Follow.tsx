import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { DoctorPhone } from '../components/DoctorPhone'
import { Icon } from '../components/Icon'
import {
  adherence,
  apptsOf,
  flagAdvice,
  LAB_DEFS,
  LEVEL4,
  labFlag,
  MOODS,
  planInfo,
  receptorText,
  type Flag,
  type LabTest,
  type Patient,
} from '../data/clinic'
import { clockLabel, dateOfRel, fmtAgo, fmtDay, fmtIn, fmtTime, hoursText, tOf, ymd } from '../lib/dates'
import { addLab, saveSymptoms, takeDose, useMine, useMode, useMyDoctor, useMyRecord, type SymptomEntry } from '../store/doctor'
import { toast } from '../store/toast'

const SEGMENTS = [
  { id: 'plan', label: 'الخطة' },
  { id: 'meds', label: 'الأدوية' },
  { id: 'symptoms', label: 'الأعراض' },
  { id: 'labs', label: 'التحاليل' },
] as const
type Segment = (typeof SEGMENTS)[number]['id']

function AskWanas({ question, children }: { question: string; children: string }) {
  const navigate = useNavigate()
  return (
    <button type="button" className="out-btn" onClick={() => navigate('/chat', { state: { ask: question } })}>
      <Icon name="chat" size={20} color="#E0177F" />
      {children}
    </button>
  )
}

/* ---------- the plan: diagnosis, steps, appointments, the doctor's notes ---------- */

function PlanPart({ p }: { p: Patient }) {
  const notes = useMine('notes')
  const pi = planInfo(p)
  const dx = p.diagnosis
  const appts = apptsOf(p).filter((a) => a.t >= Date.now() - 12 * 3600000)
  return (
    <>
      <section className="wcard">
        <h2 className="h2p">التشخيص</h2>
        <div className="chips-row">
          {dx?.stage && (
            <span className="chip-s">
              <bdi>Stage {dx.stage}</bdi>
            </span>
          )}
          {dx?.er != null && (
            <span className="chip-s">
              <bdi>{receptorText(dx)}</bdi>
            </span>
          )}
          {dx?.grade && (
            <span className="chip-s">
              <bdi>Grade {dx.grade}</bdi>
            </span>
          )}
        </div>
        <div className="muted12">
          أكده {dx?.by || 'طبيبك'}
          {dx?.confirmedAt ? ' ' + fmtAgo(Date.parse(dx.confirmedAt)) : ''}
        </div>
        <AskWanas question="اشرحيلي تشخيصي ببساطة">اسألي ونس يعني إيه</AskWanas>
      </section>

      <section className="wcard">
        <h2 className="h2p">خطة العلاج</h2>
        <ol className="tl">
          {pi.steps.map((s) => {
            const t = dateOfRel(s).getTime()
            return (
              <li key={s.id} className={s.status}>
                <span className="tl-dot" aria-hidden="true" />
                <div>
                  <div className="tl-t">{s.title}</div>
                  <div className="muted12">
                    {s.status === 'done' ? 'خلصت · ' + fmtDay(t) : (s.status === 'current' ? 'الخطوة الحالية · ' : '') + fmtIn(t) + ' · ' + fmtDay(t)}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="wcard">
        <h2 className="h2p">المواعيد</h2>
        {appts.length ? (
          appts.map((a) => (
            <div key={a.id} className="ln">
              {a.title} · {fmtIn(a.t)} · {fmtDay(a.t)} الساعة {fmtTime(a.t)}
            </div>
          ))
        ) : (
          <div className="muted14">مفيش مواعيد قريبة</div>
        )}
      </section>

      <section className="wcard">
        <h2 className="h2p">ملاحظات الطبيب</h2>
        {notes.length ? (
          [...notes].reverse().map((n) => (
            <div key={n.id} className="note-item">
              <p>{n.text}</p>
              <span className="muted12">{fmtAgo(tOf(n))}</span>
            </div>
          ))
        ) : (
          <div className="muted14">لسه مفيش ملاحظات</div>
        )}
      </section>
    </>
  )
}

/* ---------- medicines: the doses of today ---------- */

function MedsPart({ p }: { p: Patient }) {
  const logs = useMine('medlogs')
  const today = ymd(new Date())
  const meds = p.meds || []
  const adh = adherence(p, logs)
  return (
    <section className="wcard">
      <h2 className="h2p">أدويتك النهارده</h2>
      {meds.length ? (
        meds.map((m) => (
          <div key={m.id} className="med">
            <div className="b15">{m.name}</div>
            <div className="muted12">
              {m.dose}
              {m.note ? ' · ' + m.note : ''}
            </div>
            <div className="dose-btns">
              {m.times.map((tm) => {
                const taken = logs.some((l) => l.medId === m.id && l.day === today && l.time === tm)
                const isDue = Date.now() >= Date.parse(`${today}T${tm}:00`) && !taken
                return (
                  <button key={tm} type="button" className={'dose' + (taken ? ' on' : isDue ? ' due' : '')} aria-pressed={taken} onClick={() => takeDose(m.id, tm)}>
                    {taken && <Icon name="check" size={16} color="#FFFFFF" stroke={3} />}
                    {clockLabel(tm)}
                    {taken ? ' · أخدتها' : isDue ? ' · حان موعدها ⏰' : ''}
                  </button>
                )
              })}
            </div>
          </div>
        ))
      ) : (
        <div className="muted14">طبيبك لسه ما كتبش أدوية</div>
      )}
      {adh != null && (
        <div className="muted14">
          التزامك آخر 7 أيام: <b>{Math.round(adh * 100)}%</b>
        </div>
      )}
      <div className="muted12">الجرعات بيكتبها الطبيب بس. أي سؤال عن دوا ابعتيه في الرسائل.</div>
    </section>
  )
}

/* ---------- symptoms: how she feels today ---------- */

const EMPTY: SymptomEntry = { fatigue: 0, nausea: 0, pain: 0, temp: '', mood: 0, note: '' }

function SymptomsPart() {
  const doctor = useMyDoctor()
  const recent = useMine('symptoms').slice(-6).reverse()
  const [s, setS] = useState<SymptomEntry>(EMPTY)
  const [result, setResult] = useState<{ saved: boolean; flags: Flag[] } | null>(null)
  const set = <K extends keyof SymptomEntry>(k: K, v: SymptomEntry[K]) => {
    setS((old) => ({ ...old, [k]: v }))
    setResult(null)
  }

  function save() {
    const r = saveSymptoms(s)
    setResult(r)
    if (r.saved) setS(EMPTY)
  }

  const scale = (k: 'fatigue' | 'nausea' | 'mood', label: string, options: string[]) => (
    <div className="fgroup">
      <div className="lbl" id={'lb-' + k}>
        {label}
      </div>
      <div className="opts" role="group" aria-labelledby={'lb-' + k}>
        {options.map((o, i) => (
          <button key={o} type="button" aria-pressed={s[k] === i} className={'opt' + (s[k] === i ? ' on' : '')} onClick={() => set(k, i)}>
            {o}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <>
      <section className="wcard">
        <h2 className="h2p">عاملة إيه النهارده؟</h2>
        {scale('fatigue', 'التعب', LEVEL4)}
        {scale('nausea', 'الغثيان', LEVEL4)}
        <div className="fgroup">
          <label className="lbl" htmlFor="symPain">
            الألم: <b>{s.pain}</b> من 10
          </label>
          <input id="symPain" type="range" min={0} max={10} step={1} value={s.pain} onChange={(e) => set('pain', Number(e.target.value))} />
        </div>
        <div className="fgroup">
          <label className="lbl" htmlFor="symTemp">
            الحرارة (°م) <span className="muted12">لو قستيها</span>
          </label>
          <input
            id="symTemp"
            className="field-in"
            type="number"
            inputMode="decimal"
            step={0.1}
            min={34}
            max={43}
            placeholder="مثلاً 37.2"
            value={s.temp}
            onChange={(e) => set('temp', e.target.value)}
          />
        </div>
        {scale('mood', 'المزاج', MOODS)}
        <div className="fgroup">
          <label className="lbl" htmlFor="symNote">
            حاجة تانية حاسة بيها؟
          </label>
          <textarea id="symNote" className="field-in ta" rows={2} value={s.note} onChange={(e) => set('note', e.target.value)} />
        </div>
        <button type="button" className="grad-btn" onClick={save}>
          سجّلي
        </button>
        {result &&
          (result.flags.length ? (
            <div className="alert-card">
              {result.flags.map((f) => (
                <div key={f.kind}>
                  <div className="at">{f.text}</div>
                  <div>{flagAdvice(f.kind)}</div>
                </div>
              ))}
              <div className="muted12">{result.saved ? 'طبيبك وصله تنبيه.' : 'التسجيل محتاج حسابك يبقى مربوط بطبيبك.'}</div>
              {result.flags.some((f) => f.severity === 'red') && <DoctorPhone doctor={doctor} />}
            </div>
          ) : (
            <div className="done-pill">
              <Icon name="check" size={16} color="#1E6B34" stroke={3} />
              {result.saved ? 'اتسجّلت، وطبيبك هيشوفها' : 'التسجيل محتاج حسابك يبقى مربوط بطبيبك'}
            </div>
          ))}
      </section>

      <section className="wcard">
        <h2 className="h2p">آخر تسجيلاتك</h2>
        {recent.length ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>اليوم</th>
                  <th>الحرارة</th>
                  <th>الألم</th>
                  <th>الغثيان</th>
                  <th>التعب</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDay(tOf(r))}</td>
                    <td>{r.temp != null ? r.temp : '—'}</td>
                    <td>{r.pain}</td>
                    <td>{LEVEL4[r.nausea] ?? ''}</td>
                    <td>{LEVEL4[r.fatigue] ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="muted14">لسه ما سجّلتيش</div>
        )}
      </section>
    </>
  )
}

/* ---------- lab results ---------- */

function LabsPart() {
  const labs = useMine('labs').slice().reverse()
  const [test, setTest] = useState<LabTest>('CA 15-3')
  const [value, setValue] = useState('')

  function add() {
    if (!addLab(test, value)) {
      toast('اكتبي القيمة بالأرقام')
      return
    }
    setValue('')
    toast('النتيجة اتضافت، وطبيبك هيشوفها')
  }

  return (
    <>
      <section className="wcard">
        <h2 className="h2p">ضيفي نتيجة تحليل</h2>
        <form
          className="lab-form"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <label htmlFor="labTest" className="sr-only">
            التحليل
          </label>
          <select id="labTest" className="field-in" value={test} onChange={(e) => setTest(e.target.value as LabTest)}>
            {(Object.keys(LAB_DEFS) as LabTest[]).map((k) => (
              <option key={k} value={k}>
                {LAB_DEFS[k].label}
              </option>
            ))}
          </select>
          <label htmlFor="labVal" className="sr-only">
            القيمة
          </label>
          <input
            id="labVal"
            className="field-in"
            type="number"
            inputMode="decimal"
            step={0.1}
            placeholder={'القيمة ' + LAB_DEFS[test].unit}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button type="submit" className="pbtn">
            إضافة
          </button>
        </form>
      </section>

      <section className="wcard">
        <h2 className="h2p">نتايجك</h2>
        {labs.length ? (
          labs.map((l) => (
            <div key={l.id} className="lab-row">
              <bdi className="b15">{l.test}</bdi>
              <span>
                <b>{l.value}</b> <bdi className="muted12">{l.unit}</bdi>
              </span>
              <span className="muted12">{fmtDay(tOf(l))}</span>
              {labFlag(l) && (
                <span className="pill yellow">
                  <i aria-hidden="true" />
                  برّه المرجعي
                </span>
              )}
            </div>
          ))
        ) : (
          <div className="muted14">لسه مفيش نتايج</div>
        )}
        <AskWanas question="اشرحيلي نتايج تحاليلي">اسألي ونس عن نتايجك</AskWanas>
      </section>
    </>
  )
}

/* ---------- the screen ---------- */

// "متابعتي": her doctor at the top, then the plan, medicines, symptoms and lab results.
export function Follow() {
  const navigate = useNavigate()
  const { seg } = useParams()
  const segment: Segment = SEGMENTS.find((s) => s.id === seg)?.id ?? 'plan'
  const mode = useMode()
  const p = useMyRecord()
  const doctor = useMyDoctor()
  const access = useMine('access')

  if (mode !== 'follow' || !p) {
    return (
      <section className="wcard">
        <h1 className="h1">متابعتي</h1>
        <p className="body15">المتابعة بتبدأ بعد ما طبيبك يأكد التشخيص.</p>
        <button type="button" className="grad-btn" onClick={() => navigate('/doctor')}>
          الدكتور
        </button>
      </section>
    )
  }

  const lastOpen = access[access.length - 1]
  return (
    <>
      <section className="wcard" style={{ gap: 10 }}>
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft">
            <Icon name="doctor" size={24} color="#E0177F" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="b15">{doctor ? doctor.name : 'طبيبك'}</div>
            <div className="muted12">{doctor ? [doctor.specialty, doctor.hospital].filter(Boolean).join(' · ') : ''}</div>
          </div>
        </div>
        <div className="row-btns">
          <DoctorPhone doctor={doctor} />
          <button type="button" className="pbtn" onClick={() => navigate('/messages')}>
            رسالة
          </button>
        </div>
        <div className="muted12">
          الرد على الرسائل {hoursText(doctor?.hours)}
          {lastOpen ? ' · ملفك اتفتح ' + fmtAgo(tOf(lastOpen)) : ''}
        </div>
      </section>

      <div className="seg" role="tablist" aria-label="أقسام المتابعة">
        {SEGMENTS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={segment === s.id}
            className={segment === s.id ? 'on' : ''}
            onClick={() => navigate('/follow/' + s.id, { replace: true })}
          >
            {s.label}
          </button>
        ))}
      </div>

      {segment === 'plan' && <PlanPart p={p} />}
      {segment === 'meds' && <MedsPart p={p} />}
      {segment === 'symptoms' && <SymptomsPart />}
      {segment === 'labs' && <LabsPart />}
    </>
  )
}
