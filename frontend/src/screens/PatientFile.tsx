import { useEffect, useState } from 'react'
import { LineChart } from '../components/LineChart'
import { ScanTile } from '../components/ScanTile'
import { ScanViewer, type ScanSource } from '../components/ScanViewer'
import {
  adherence,
  apptsOf,
  dxShort,
  labFlag,
  LEVEL4,
  MOODS,
  ORDER_LABEL,
  ORDERABLE,
  PLAN_LABELS,
  planInfo,
  priority,
  receptorText,
  ruleSummary,
  UPLOAD_NAME,
  type Access,
  type Alert,
  type Message,
  type Note,
  type OrderId,
  type Patient,
  type Records,
  type SharedFile,
  type Symptom,
} from '../data/clinic'
import { TEST_SLOTS, type TestId } from '../data/tests'
import { DAY, dateOfRel, fmtAgo, fmtDay, fmtIn, fmtTime, fmtWhen, tOf } from '../lib/dates'
import {
  accept,
  addAppt,
  addMed,
  addNote,
  advance,
  closeAlert,
  confirmDx,
  decline,
  delAppt,
  delMed,
  markReadByDoctor,
  sendMessage,
  sendOrders,
  type DxForm,
} from '../store/dashboard'

const Pill = ({ tone, children }: { tone: 'red' | 'yellow' | 'green'; children: string }) => (
  <span className={'pill ' + tone}>
    <i aria-hidden="true" />
    {children}
  </span>
)

function AlertsCard({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) return null
  return (
    <div className="dcard" id="sec-alerts">
      <h2>تنبيهات مفتوحة</h2>
      {alerts.map((a) => (
        <div key={a.id} className="alert-line">
          <Pill tone={a.severity === 'red' ? 'red' : 'yellow'}>{a.severity === 'red' ? 'عاجل' : 'مراجعة'}</Pill>
          <span style={{ flex: 1, minWidth: 0 }}>
            {a.text}
            <span className="muted12">
              {' · ' + fmtAgo(tOf(a))}
              {a.by === 'ai' ? ' · رصده الذكاء الاصطناعي' : ''}
            </span>
          </span>
          <button type="button" className="mbtn" onClick={() => closeAlert(a)}>
            اتعاملت معاه
          </button>
        </div>
      ))}
    </div>
  )
}

// The one-minute summary, written from her data. Each line jumps to its part of the page.
function SummaryCard({ p, records }: { p: Patient; records: Records }) {
  const lines = ruleSummary(p, records)
  const jump = (ref: string) => document.getElementById('sec-' + ref)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <div className="dcard">
      <h2>
        <span>الملخص الذكي</span>
        <span className="ai-tag">ملخص تلقائي من البيانات</span>
      </h2>
      <div className="sum">
        {lines.map((l) => (
          <button key={l.label} type="button" className="sumline" onClick={() => jump(l.ref)}>
            <b>{l.label}</b>
            <span>{l.text}</span>
          </button>
        ))}
      </div>
      <div className="muted12">ملخص آلي. راجعي البيانات الأصلية قبل أي قرار.</div>
    </div>
  )
}

const LABEL = Object.fromEntries(TEST_SLOTS.map((t) => [t.id, t.title])) as Record<TestId, string>
// The practice patients list only the names of their files; this finds the box of each name.
const TEST_BY_NAME = Object.fromEntries(Object.entries(UPLOAD_NAME).map(([id, name]) => [name, id])) as Record<string, TestId>

// The scans and reports she uploaded. A click opens the viewer (zoom, brightness, contrast, invert).
function ScansCard({ p }: { p: Patient }) {
  const [open, setOpen] = useState<{ source: ScanSource; title: string; demo: boolean } | null>(null)
  const practice = !p.files && !!p.demo
  const files: SharedFile[] =
    p.files ??
    (p.demo
      ? (p.uploads ?? [])
          .map((n) => TEST_BY_NAME[n])
          .filter(Boolean)
          .map((test) => ({ test, name: LABEL[test], type: 'image/jpeg', size: 0, at: '', demo: true }))
      : [])
  return (
    <div className="dcard" id="sec-scans">
      <h2>
        <span>الأشعة والملفات</span>
        {files.length > 0 && <span className="muted12">اضغطي على أي ملف علشان تفتحيه وتكبّريه</span>}
      </h2>
      {files.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
          {files.map((f) => (
            <ScanTile
              key={f.test + f.at}
              label={LABEL[f.test]}
              file={f}
              spec={{ pid: p.id, test: f.test, at: f.at, practice }}
              onOpen={(source) => setOpen({ source, title: LABEL[f.test] + ' · ' + p.name, demo: f.demo })}
            />
          ))}
        </div>
      ) : p.uploads && p.uploads.length ? (
        <div className="muted14">الملفات: {p.uploads.join('، ')}. اترفعت قبل ما التطبيق يحفظ الصور نفسها، فاطلبي منها ترفعها تاني.</div>
      ) : (
        <div className="muted14">لسه ما رفعتش ملفات</div>
      )}
      {practice && <div className="muted12">مريضة تجريبية: الصور دي متعملة للعرض، ومش أشعة حقيقية.</div>}
      <div className="muted12">الصور هنا للمراجعة والمتابعة. التشخيص بيتأكد من الأشعة الأصلية وتقرير الأشعة والعيّنة.</div>
      {open && <ScanViewer title={open.title} source={open.source} demo={open.demo} onClose={() => setOpen(null)} />}
    </div>
  )
}

// Before the diagnosis: the tests the doctor asks for. They reach the patient's app with a message.
function OrdersCard({ p }: { p: Patient }) {
  const o = p.orders || null
  const [sel, setSel] = useState<OrderId[]>(() => (o ? o.tests : p.age && p.age < 40 ? ['us'] : ['mammo', 'us']))
  const up = p.uploads || []
  const toggle = (id: OrderId) => setSel((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  return (
    <div className="dcard" id="sec-orders">
      <h2>
        <span>طلب الفحوصات</span>
        {o && <span className="muted12">اتبعت {fmtAgo(Date.parse(o.at))}</span>}
      </h2>
      {o ? (
        <div className="sum">
          {o.tests.map((id) => {
            const done = up.includes(UPLOAD_NAME[id])
            return (
              <div key={id} className="alert-line">
                <Pill tone={done ? 'green' : 'yellow'}>{done ? 'اترفع' : 'مستني'}</Pill>
                <span style={{ flex: 1, minWidth: 0 }}>{ORDER_LABEL[id]}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="body15">اختاري الفحوصات اللي محتاجاها {p.name || 'المريضة'}، والطلب هيوصلها في التطبيق ومعاه رسالة منك.</p>
      )}
      <div className="tglrow" role="group" aria-label="الفحوصات">
        {ORDERABLE.map((id) => (
          <button key={id} type="button" className="tgl" aria-pressed={sel.includes(id)} onClick={() => toggle(id)}>
            {ORDER_LABEL[id]}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="pbtn"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => sendOrders(p, ORDERABLE.filter((id) => sel.includes(id)))}
      >
        {o ? 'حدّثي الطلب' : 'ابعتي الطلب'}
      </button>
    </div>
  )
}

const STAGES = ['0', 'IA', 'IB', 'IIA', 'IIB', 'IIIA', 'IIIB', 'IIIC', 'IV']
const RESULTS: [DxForm['result'], string][] = [
  ['malignant', 'ورم خبيث'],
  ['benign', 'ورم حميد'],
  ['normal', 'سليمة'],
]

// Before the diagnosis: the app's assessment and scan reading, then the doctor confirms the result.
function ConfirmCard({ p }: { p: Patient }) {
  const [f, setF] = useState<DxForm>({ result: 'malignant', stage: 'IIA', er: true, pr: true, her2: false, grade: '2', plan: 'surgery_first' })
  const set = <K extends keyof DxForm>(k: K, v: DxForm[K]) => setF((old) => ({ ...old, [k]: v }))
  const pa = p.assessment
  const pred = p.prediction
  return (
    <div className="dcard" id="sec-files">
      <h2>مراجعة التنبؤ وتأكيد التشخيص</h2>
      <div className="grid2" style={{ gap: 8 }}>
        <div className="note-item">
          <div className="muted12">تقييم الاحتمالية في التطبيق</div>
          <div className="b15">{pa ? pa.label : 'لسه ما اتعملش'}</div>
          {pa && pa.factors.length > 0 && <div className="muted12">{pa.factors.join('، ')}</div>}
        </div>
        <div className="note-item">
          <div className="muted12">تنبؤ نموذج الأشعة</div>
          <div className="b15">
            <bdi>{pred ? pred.birads : 'لسه مفيش تحليل'}</bdi>
          </div>
          {pred && (
            <div className="muted12">
              {pred.label}
              {pred.demo ? ' · قيمة عرض' : ''}
            </div>
          )}
        </div>
      </div>
      <div className="muted14">{p.uploads && p.uploads.length ? 'الملفات المرفوعة: ' + p.uploads.join('، ') : 'لسه ما رفعتش ملفات'}</div>
      <h3>نتيجة العيّنة والتشخيص</h3>
      <div className="tglrow" role="group" aria-label="النتيجة">
        {RESULTS.map(([k, label]) => (
          <button key={k} type="button" className="tgl" aria-pressed={f.result === k} onClick={() => set('result', k)}>
            {label}
          </button>
        ))}
      </div>
      {f.result === 'malignant' ? (
        <>
          <div className="form-grid">
            <label>
              المرحلة
              <select className="inp" value={f.stage} onChange={(e) => set('stage', e.target.value)}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    Stage {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              الدرجة (Grade)
              <select className="inp" value={f.grade} onChange={(e) => set('grade', e.target.value)}>
                {['1', '2', '3'].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="tglrow" role="group" aria-label="مستقبلات الورم">
            {(['er', 'pr', 'her2'] as const).map((k) => (
              <button key={k} type="button" className="tgl" aria-pressed={f[k]} onClick={() => set(k, !f[k])}>
                <bdi>
                  {k.toUpperCase()}
                  {f[k] ? '+' : '−'}
                </bdi>
              </button>
            ))}
          </div>
          <label className="fl">
            خطة العلاج المبدئية
            <select className="inp" value={f.plan} onChange={(e) => set('plan', e.target.value)}>
              {Object.keys(PLAN_LABELS).map((k) => (
                <option key={k} value={k}>
                  {PLAN_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <div className="muted12">التواريخ بتتحسب من النهارده، وبعدها تقدري تعدّلي المواعيد وتضيفي الأدوية.</div>
        </>
      ) : (
        <div className="muted14">
          {f.result === 'benign' ? 'المريضة هترجع لوضع المتابعة الدورية مع الفحص الذاتي الشهري.' : 'المريضة هترجع لوضع الفحص الدوري.'}
        </div>
      )}
      <button type="button" className="grad-btn" onClick={() => confirmDx(p, f)}>
        تأكيد التشخيص
      </button>
    </div>
  )
}

// After the diagnosis: the plan (or the routine follow-up) and the appointments.
function PlanCard({ p }: { p: Patient }) {
  const [a, setA] = useState({ title: '', date: '', time: '10:00' })
  const dx = p.diagnosis
  const pi = planInfo(p)
  const appts = apptsOf(p)
  const malignant = dx?.result === 'malignant'
  return (
    <div className="dcard" id="sec-plan">
      <h2>
        <span>{malignant ? 'خطة العلاج' : 'المتابعة'}</span>
        {malignant ? (
          <span className="chips-row">
            <span className="chip-s">
              <bdi>Stage {dx?.stage}</bdi>
            </span>
            <span className="chip-s">
              <bdi>{receptorText(dx)}</bdi>
            </span>
            {dx?.grade && (
              <span className="chip-s">
                <bdi>Grade {dx.grade}</bdi>
              </span>
            )}
          </span>
        ) : (
          <Pill tone="green">{dx?.result === 'benign' ? 'ورم حميد' : 'سليمة'}</Pill>
        )}
      </h2>
      {pi.steps.length > 0 && (
        <ol className="tl">
          {pi.steps.map((s) => {
            const t = dateOfRel(s).getTime()
            return (
              <li key={s.id} className={s.status}>
                <span className="tl-dot" aria-hidden="true" />
                <div>
                  <div className="tl-t">{s.title}</div>
                  <div className="muted12">
                    {s.status === 'current' ? 'الخطوة الحالية · ' : s.status === 'done' ? 'خلصت · ' : ''}
                    {fmtDay(t)} · {fmtIn(t)}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {pi.cur && (
        <button type="button" className="pbtn" style={{ alignSelf: 'flex-start' }} onClick={() => advance(p)}>
          الخطوة الحالية خلصت
        </button>
      )}
      <h3>المواعيد</h3>
      {appts.length ? (
        appts.map((x) => (
          <div key={x.id} className="alert-line">
            <span style={{ flex: 1, minWidth: 0 }}>
              {x.title} · {fmtDay(x.t)} الساعة {fmtTime(x.t)} · {fmtIn(x.t)}
            </span>
            <button type="button" className="mbtn" onClick={() => delAppt(p, x.id)}>
              حذف
            </button>
          </div>
        ))
      ) : (
        <div className="muted14">مفيش مواعيد</div>
      )}
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          if (addAppt(p, a)) setA({ title: '', date: '', time: '10:00' })
        }}
      >
        <label>
          الميعاد
          <input className="inp" value={a.title} placeholder="مثلاً مراجعة في العيادة" onChange={(e) => setA({ ...a, title: e.target.value })} />
        </label>
        <label>
          اليوم
          <input className="inp" type="date" value={a.date} onChange={(e) => setA({ ...a, date: e.target.value })} />
        </label>
        <label>
          الساعة
          <input className="inp" type="time" value={a.time} onChange={(e) => setA({ ...a, time: e.target.value })} />
        </label>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="submit" className="mbtn">
            إضافة ميعاد
          </button>
        </div>
      </form>
    </div>
  )
}

const NO_MED = { name: '', dose: '', times: '08:00, 20:00', note: '' }

function MedsCard({ p, adh }: { p: Patient; adh: number | null }) {
  const [m, setM] = useState(NO_MED)
  const meds = p.meds || []
  return (
    <div className="dcard" id="sec-meds">
      <h2>
        <span>الأدوية</span>
        {adh != null && (
          <span className="muted14">
            الالتزام آخر 7 أيام <b>{Math.round(adh * 100)}%</b>
          </span>
        )}
      </h2>
      {meds.length ? (
        meds.map((x) => (
          <div key={x.id} className="alert-line">
            <span style={{ flex: 1, minWidth: 0 }}>
              <b>{x.name}</b> · {x.dose} · <bdi>{x.times.join(' / ')}</bdi>
              {x.note ? ' · ' + x.note : ''}
            </span>
            <button type="button" className="mbtn" onClick={() => delMed(p, x.id)}>
              حذف
            </button>
          </div>
        ))
      ) : (
        <div className="muted14">مفيش أدوية مكتوبة</div>
      )}
      <form
        className="flex flex-col gap-2.5"
        onSubmit={(e) => {
          e.preventDefault()
          if (addMed(p, m)) setM(NO_MED)
        }}
      >
        <div className="form-grid">
          <label>
            اسم الدوا
            <input className="inp" value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} />
          </label>
          <label>
            الجرعة
            <input className="inp" value={m.dose} placeholder="مثلاً قرص واحد" onChange={(e) => setM({ ...m, dose: e.target.value })} />
          </label>
          <label>
            المواعيد
            <input className="inp" dir="ltr" value={m.times} placeholder="08:00, 20:00" onChange={(e) => setM({ ...m, times: e.target.value })} />
          </label>
          <label>
            ملاحظة
            <input className="inp" value={m.note} placeholder="مثلاً بعد الأكل" onChange={(e) => setM({ ...m, note: e.target.value })} />
          </label>
        </div>
        <button type="submit" className="mbtn" style={{ alignSelf: 'flex-start' }}>
          إضافة دوا
        </button>
      </form>
    </div>
  )
}

function SymptomTable({ rows }: { rows: Symptom[] }) {
  const r = [...rows].sort((a, b) => tOf(b) - tOf(a)).slice(0, 7)
  if (!r.length) return <div className="muted14">مفيش أعراض مسجّلة آخر أسبوعين</div>
  return (
    <>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>اليوم</th>
              <th>الحرارة</th>
              <th>الألم</th>
              <th>الغثيان</th>
              <th>التعب</th>
              <th>المزاج</th>
            </tr>
          </thead>
          <tbody>
            {r.map((s) => (
              <tr key={s.id}>
                <td>{fmtDay(tOf(s))}</td>
                <td>{s.temp != null ? s.temp : '—'}</td>
                <td>{s.pain || 0}</td>
                <td>{LEVEL4[s.nausea || 0]}</td>
                <td>{LEVEL4[s.fatigue || 0]}</td>
                <td>{MOODS[s.mood || 0]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {r
        .filter((s) => s.note)
        .slice(0, 2)
        .map((s) => (
          <div key={s.id} className="muted12">
            «{s.note}» · {fmtDay(tOf(s))}
          </div>
        ))}
    </>
  )
}

const TEMPLATES = [
  'كمّلي على العلاج زي ما هو.',
  'احجزي ميعاد في العيادة الأسبوع ده.',
  'اعملي صورة دم كاملة (CBC) وارفعيها هنا.',
  'لو الحرارة 38 أو أكتر روحي أقرب طوارئ فوراً وكلّميني.',
]

function MessagesCard({ p, messages }: { p: Patient; messages: Message[] }) {
  const [draft, setDraft] = useState('')
  return (
    <div className="dcard" id="sec-messages">
      <h2>الرسائل</h2>
      <div className="thread" style={{ maxHeight: 380, overflowY: 'auto', padding: 2 }}>
        {messages.length ? (
          messages.map((m) =>
            m.from === 'doctor' ? (
              <div key={m.id} className="m-me">
                {m.text}
                <span className="m-meta">{fmtWhen(tOf(m))}</span>
              </div>
            ) : m.from === 'system' ? (
              <div key={m.id} className="sysnote">
                {m.text}
              </div>
            ) : (
              <div key={m.id} className="m-dr">
                <b>
                  {p.name}
                  {m.urgent ? ' · عاجلة' + (m.reason ? ': ' + m.reason : '') : ''}
                </b>
                {m.text}
                <span className="m-meta">{fmtWhen(tOf(m))}</span>
              </div>
            ),
          )
        ) : (
          <div className="muted14">مفيش رسائل لسه</div>
        )}
      </div>
      <div className="chips">
        {TEMPLATES.map((t) => (
          <button key={t} type="button" className="chip" onClick={() => setDraft(t)}>
            {t}
          </button>
        ))}
      </div>
      <form
        className="row-btns"
        onSubmit={(e) => {
          e.preventDefault()
          if (sendMessage(p, draft)) setDraft('')
        }}
      >
        <label htmlFor="drMsg" className="sr-only">
          ردك على {p.name}
        </label>
        <input
          id="drMsg"
          className="inp"
          style={{ flex: 1, minWidth: 200 }}
          value={draft}
          placeholder={'اكتبي رد لـ ' + (p.name || 'المريضة')}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="pbtn">
          إرسال
        </button>
      </form>
    </div>
  )
}

function NotesCard({ p, notes }: { p: Patient; notes: Note[] }) {
  const [draft, setDraft] = useState('')
  return (
    <div className="dcard">
      <h2>ملاحظات الزيارة</h2>
      <label htmlFor="drNote" className="sr-only">
        ملاحظة جديدة
      </label>
      <textarea
        id="drNote"
        className="inp"
        placeholder="اكتبي ملاحظة الزيارة والتعليمات. المريضة هتشوفها، وونس تشرحهالها."
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button
        type="button"
        className="pbtn"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => {
          if (addNote(p, draft)) setDraft('')
        }}
      >
        حفظ الملاحظة
      </button>
      {notes.map((n) => (
        <div key={n.id} className="note-item">
          <p>{n.text}</p>
          <span className="muted12">{fmtWhen(tOf(n))}</span>
        </div>
      ))}
    </div>
  )
}

type Props = { p: Patient; records: Records; access: Access[]; onBack: () => void }

// One patient's file in the doctor's dashboard: the summary first, then everything it was written from.
export function PatientFile({ p, records, access, onBack }: Props) {
  const pr = priority(p, records)
  const dx = p.diagnosis
  const mine = <T extends { pid: string }>(rows: T[]) => rows.filter((x) => x.pid === p.id)
  const alerts = mine(records.alerts)
    .filter((a) => a.status === 'open')
    .sort((a, b) => tOf(b) - tOf(a))
  const syms14 = mine(records.symptoms).filter((s) => tOf(s) >= Date.now() - 14 * DAY)
  const temps = syms14.filter((s) => s.temp != null).map((s) => ({ t: tOf(s), v: Number(s.temp) }))
  const ca = mine(records.labs)
    .filter((l) => l.test === 'CA 15-3')
    .map((l) => ({ t: tOf(l), v: Number(l.value) }))
  const otherLabs = mine(records.labs)
    .filter((l) => l.test !== 'CA 15-3')
    .sort((a, b) => tOf(b) - tOf(a))
  const messages = mine(records.messages).sort((a, b) => tOf(a) - tOf(b))
  const notes = mine(records.notes).sort((a, b) => tOf(b) - tOf(a))
  const opened = mine(access)
    .sort((a, b) => tOf(b) - tOf(a))
    .slice(0, 5)
  const adh = adherence(p, records.medlogs)

  // Her messages count as read while her file is open.
  const unread = messages.filter((m) => m.from === 'patient' && !m.readD).length
  useEffect(() => {
    if (unread) markReadByDoctor(p.id)
  }, [unread, p.id])

  const active = p.link === 'active'
  return (
    <>
      <button type="button" className="mbtn only-narrow" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
        رجوع للقائمة
      </button>

      <div className="dcard">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="avatar-i" style={{ width: 52, height: 52, fontSize: 22 }} aria-hidden="true">
            {(p.name || '؟').trim().charAt(0)}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
              {p.name}
              {p.age ? <span className="muted14"> · {p.age} سنة</span> : null}
            </h1>
            <div className="prow-sub">{dxShort(p)}</div>
          </div>
          {active && <Pill tone={pr.tone}>{pr.word}</Pill>}
        </div>
        {p.chronic && p.chronic.length > 0 && <div className="muted12">أمراض مزمنة: {p.chronic.join('، ')}</div>}
        {p.demo && <div className="muted12">بيانات تجريبية للعرض</div>}
      </div>

      {p.link === 'pending' && (
        <div className="dcard">
          <h2>طلب ربط</h2>
          <p className="body15">{p.name} عايزة تربط حسابها بيكِ، ووافقت إنك تشوفي بياناتها.</p>
          <div className="row-btns">
            <button type="button" className="pbtn" onClick={() => accept(p)}>
              قبول
            </button>
            <button type="button" className="mbtn" onClick={() => decline(p)}>
              رفض
            </button>
          </div>
        </div>
      )}

      <AlertsCard alerts={alerts} />
      <SummaryCard p={p} records={records} />
      <ScansCard p={p} />
      {!dx && active && <OrdersCard p={p} />}
      {!dx && active && <ConfirmCard p={p} />}
      {dx && <PlanCard p={p} />}
      {dx?.result === 'malignant' && <MedsCard p={p} adh={adh} />}

      <div className="grid2">
        <div className="dcard" id="sec-symptoms">
          <h2>
            <span>الحرارة آخر أسبوعين</span>
            <span className="muted12">°م · الخط الأحمر 38</span>
          </h2>
          <LineChart
            points={temps}
            yMin={36}
            yMax={39}
            refValue={38}
            alarmAbove
            unit="°م"
            label={'منحنى الحرارة لـ ' + p.name}
            empty="مفيش قياسات حرارة كفاية للرسم"
          />
          <SymptomTable rows={syms14} />
        </div>
        <div className="dcard" id="sec-labs">
          <h2>
            <span>CA 15-3</span>
            <span className="muted12">U/mL · الحد المرجعي 30</span>
          </h2>
          <LineChart points={ca} yMin={0} refValue={30} alarmAbove unit="U/mL" label={'منحنى CA 15-3 لـ ' + p.name} empty="محتاجين نتيجتين على الأقل للرسم" />
          {ca.length > 0 && (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  {[...ca]
                    .sort((a, b) => b.t - a.t)
                    .map((x, i) => (
                      <tr key={i}>
                        <td>{fmtDay(x.t)}</td>
                        <td>{x.v}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          {otherLabs.map((l) => (
            <div key={l.id} className="lab-row">
              <bdi className="b15">{l.test}</bdi>
              <span>
                <b>{l.value}</b> <bdi className="muted12">{l.unit}</bdi>
              </span>
              <span className="muted12">{fmtDay(tOf(l))}</span>
              {labFlag(l) && <Pill tone="yellow">برّه المرجعي</Pill>}
            </div>
          ))}
        </div>
      </div>

      <MessagesCard p={p} messages={messages} />
      <NotesCard p={p} notes={notes} />

      <div className="dcard">
        <h2>سجل فتح الملف</h2>
        {opened.length ? (
          opened.map((x) => (
            <div key={x.id} className="muted14">
              {x.who || 'الطبيب'} · {fmtAgo(tOf(x))}
            </div>
          ))
        ) : (
          <div className="muted14">لسه</div>
        )}
        <div className="muted12">المريضة بتشوف آخر مرة اتفتح فيها ملفها.</div>
      </div>
    </>
  )
}
