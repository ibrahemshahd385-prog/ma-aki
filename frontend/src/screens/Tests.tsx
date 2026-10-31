import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { useScanSource } from '../components/ScanTile'
import { ScanViewer } from '../components/ScanViewer'
import { TEST_SLOTS, type TestId } from '../data/tests'
import type { LabValue } from '../lib/api'
import { sendToDoctor, useMode, useMyDoctor, useMyId } from '../store/doctor'
import { hasScan, useTests } from '../store/tests'
import { readLabReport, removeUpload, runAnalysis, uploadFile } from '../store/uploads'

const MAX_MB = 40

type SlotProps = { id: TestId; title: string; sub: string }

// One box: its name, what goes in it, and either the upload button or what she uploaded (a tap opens it).
function Slot({ id, title, sub }: SlotProps) {
  const upload = useTests((s) => s.uploads[id])
  const pid = useMyId()
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [viewing, setViewing] = useState(false)
  const source = useScanSource(viewing && upload && pid ? { pid, test: id, at: upload.at, practice: false } : null)

  async function onFile(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`الملف أكبر من ${MAX_MB} ميجا. اختاري ملف أصغر.`)
      return
    }
    setError('')
    setBusy(true)
    await uploadFile(id, file)
    setBusy(false)
  }

  return (
    <div className="flex min-h-[150px] flex-col gap-2 rounded-[18px] bg-white p-3.5">
      <p className="text-sm font-extrabold">{title}</p>
      <p className="flex-1 text-xs leading-normal text-muted">{sub}</p>

      {upload && (
        <button type="button" onClick={() => setViewing(true)} aria-label={'افتحي ' + title} className="flex flex-col gap-1 text-right">
          {upload.thumb ? (
            <img src={upload.thumb} alt={'صورة ' + title} className="h-16 w-full rounded-[10px] object-cover" />
          ) : (
            <span className="text-xs break-all text-body">{upload.name}</span>
          )}
          {upload.demo && <span className="text-xs font-bold text-brand-deep">ملف تجريبي</span>}
        </button>
      )}
      {viewing && source === 'missing' && (
        <p role="alert" className="text-xs font-bold text-[#A3123A]">
          الملف ده اترفع قبل ما التطبيق يحفظ الملفات نفسها. ارفعيه تاني علشان الدكتور يشوفه.
        </p>
      )}
      {viewing && source && source !== 'missing' && (
        <ScanViewer title={title} source={source} demo={upload?.demo} onClose={() => setViewing(false)} />
      )}

      {upload ? (
        <>
          <p className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#E6F4EA] text-[13px] font-bold text-[#1E6B34]">
            <Icon name="check" size={16} color="#1E6B34" stroke={3} />
            تم الرفع
          </p>
          <button
            type="button"
            onClick={() => {
              setViewing(false)
              removeUpload(id)
            }}
            className="min-h-11 text-xs font-bold text-brand-deep"
          >
            شيلي الملف
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="min-h-11 rounded-xl border-[1.5px] border-dashed border-brand bg-app text-[13px] font-bold text-brand-deep"
        >
          {busy ? 'بيرفع…' : '+ رفع صورة أو ملف'}
        </button>
      )}

      {error && (
        <p role="alert" className="text-xs font-bold text-[#A3123A]">
          {error}
        </p>
      )}
      {/* The real file picker is hidden; the dashed button above opens it. */}
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf,.dcm"
        hidden
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = '' // so choosing the same file again still works
        }}
      />
    </div>
  )
}

// After "حلّلي النتائج": the scan model's reading goes to her doctor, not to her. A percentage on its own, without the
// exam, would frighten her or wrongly reassure her (the model misses about half of the suspicious cases at its
// threshold), so she sees the same calm message whatever it says. The doctor sees the details (screens/PatientFile.tsx).
function ScanSent() {
  const navigate = useNavigate()
  const mode = useMode()
  const doctor = useMyDoctor()
  const r = useTests((s) => s.reading)
  if (!r) return null
  const dn = doctor ? doctor.name : 'طبيبك'
  const text =
    mode === 'pre'
      ? 'القراءة اتحفظت في ملفك. الأشعة لازم طبيب يقراها مع الكشف، فاكشفي عند دكتور واربطي حسابك بيه، وهو هيشوف الصور والقراءة ويشرحلك.'
      : mode === 'pending'
        ? 'القراءة اتحفظت في ملفك، وأول ما طبيبك يوافق على الربط هيشوفها مع الصور ويشرحلك.'
        : `القراءة وصلت عند ${dn} مع الصور، وهو اللي هيراجعها مع الكشف ويشرحلك النتيجة.`
  return (
    <>
      <section className="flex flex-col gap-3 rounded-[22px] border-[1.5px] border-brand-line bg-white p-[18px]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-base font-extrabold">
            <Icon name="check" size={18} color="#1E6B34" stroke={3} />
            الأشعة اتقرت بالذكاء الاصطناعي
          </h2>
          {r.demo && <span className="shrink-0 rounded-lg bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand-deep">ملف تجريبي</span>}
        </div>
        <p className="text-sm leading-[1.8] text-body">{text}</p>
        <p className="rounded-[14px] bg-app px-3 py-2.5 text-xs leading-[1.8] text-muted">
          الذكاء الاصطناعي هنا بيساعد الطبيب وهو بيقرا الصور، ومش بيشخّص. والتقرير اللي بيكتبه طبيب الأشعة هو الأساس.
        </p>
        {mode === 'pre' && (
          <Button variant="small" className="self-start" onClick={() => navigate('/doctor')}>
            اربطي حسابك بطبيبك
          </Button>
        )}
      </section>

      <Button variant="outline" onClick={() => navigate('/chat', { state: { ask: 'اشرحيلي تقرير الأشعة' } })}>
        <Icon name="chat" size={20} color="#E0177F" />
        خلّي ونس تشرحلك تقرير الأشعة
      </Button>
    </>
  )
}

const STATUS = { low: 'أقل من الطبيعي', normal: 'طبيعي', high: 'أعلى من الطبيعي' } as const
const SEVERITY_COLOR = { ok: 'text-[#1E6B34]', yellow: 'text-[#8A5A00]', red: 'text-[#A3123A]' } as const

const rangeText = (v: LabValue) =>
  v.low !== null && v.high !== null ? `${v.low}–${v.high}` : v.high !== null ? `أقل من ${v.high}` : v.low !== null ? `أكتر من ${v.low}` : '—'

// Her lab values (read by Claude from the report) next to the normal ranges, with what needs her doctor.
function LabsReading() {
  const labs = useTests((s) => s.labs)
  const mode = useMode()
  const [sent, setSent] = useState(false)
  if (!labs) return null
  const flagged = labs.values.filter((v) => v.status !== 'normal')
  const linked = mode === 'linked' || mode === 'follow' || mode === 'routine'
  const summary =
    'قراءة آلية لتحاليل الدم' +
    (labs.report_date ? ` (${labs.report_date})` : '') +
    ': ' +
    labs.values.map((v) => `${v.name} ${v.value} ${v.unit} (${STATUS[v.status]})`).join('، ')
  return (
    <section className="flex flex-col gap-3 rounded-[22px] border-[1.5px] border-brand-line bg-white p-[18px]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-extrabold">قراءة التحاليل</h2>
        {labs.demo && <span className="shrink-0 rounded-lg bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand-deep">ملف تجريبي</span>}
      </div>
      {labs.severity === 'red' && (
        <p role="alert" className="rounded-[14px] bg-[#FDE7EC] px-3 py-2.5 text-sm font-bold leading-[1.8] text-[#A3123A]">
          فيه قيمة محتاجة تكلّمي طبيبتك النهارده.
        </p>
      )}
      <div className="flex flex-col gap-2">
        {labs.values.map((v) => (
          <div key={v.test} className="flex flex-col gap-1 rounded-[14px] bg-app p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold">{v.name}</p>
              <p className={'text-sm font-extrabold ' + SEVERITY_COLOR[v.severity]}>{STATUS[v.status]}</p>
            </div>
            <p className="text-[13px] text-body">
              <bdi dir="ltr">
                {v.value} {v.unit}
              </bdi>
              {' · المعدل: '}
              <bdi dir="ltr">{rangeText(v)}</bdi> ({v.source})
            </p>
            {v.note && <p className={'text-xs leading-[1.7] ' + SEVERITY_COLOR[v.severity]}>{v.note}</p>}
          </div>
        ))}
      </div>
      <p className="text-xs leading-[1.8] text-muted">{labs.disclaimer}</p>
      {flagged.length > 0 &&
        (linked ? (
          <Button variant="small" className="self-start" disabled={sent} onClick={() => setSent(sendToDoctor(summary))}>
            {sent ? 'اتبعتت لطبيبتك' : 'ابعتي القراءة لطبيبتك'}
          </Button>
        ) : (
          <p className="text-xs text-muted">لما تربطي حسابك بطبيبك، هتقدري تبعتيله القراءة دي.</p>
        ))}
    </section>
  )
}

// When her lab report couldn't be read: a calm card, not an error. She has nothing to type; the paper itself is
// kept in her file for her doctor, and she can try again (or take a clearer photo when it says so).
function LabsNote({ note, onRetried }: { note: string; onRetried: (note: string | null) => void }) {
  const mode = useMode()
  const doctor = useMyDoctor()
  const [busy, setBusy] = useState(false)
  const linked = mode === 'linked' || mode === 'follow' || mode === 'routine'
  return (
    <section className="flex flex-col gap-3 rounded-[22px] border-[1.5px] border-brand-line bg-white p-[18px]">
      <h2 className="text-base font-extrabold">قراءة التحاليل</h2>
      <p className="text-sm leading-[1.8] text-body">{note}</p>
      <p className="rounded-[14px] bg-brand-soft px-3 py-2.5 text-[13px] leading-[1.8] text-body">
        {linked ? `ورقة التحاليل نفسها وصلت عند ${doctor ? doctor.name : 'طبيبك'}، وهو يقدر يشوفها.` : 'ورقة التحاليل نفسها اتحفظت في ملفك.'}
      </p>
      <Button
        variant="small"
        className="self-start"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          const next = await readLabReport()
          setBusy(false)
          onRetried(next)
        }}
      >
        {busy ? 'بيقرا التقرير…' : 'جرّبي تاني'}
      </Button>
    </section>
  )
}

export function Tests() {
  const mode = useMode()
  const doctor = useMyDoctor()
  const scan = useTests((s) => hasScan(s.uploads))
  const reading = useTests((s) => s.reading)
  const lab = useTests((s) => !!s.uploads.lab)
  const labs = useTests((s) => s.labs)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState('')
  const [labsNote, setLabsNote] = useState('') // why her lab report couldn't be read
  const dn = doctor ? doctor.name : 'طبيبك'
  const note =
    mode === 'pre'
      ? 'الفحوصات بتتعمل بطلب الدكتور بعد الكشف. ولو معاكِ أشعة عملتيها قبل كده ارفعيها، والدكتور هيلاقيها في ملفك بعد ما تربطي حسابك.'
      : mode === 'pending'
        ? 'طلب الربط مستني الموافقة، وبعدها الدكتور هيشوف فحوصاتك.'
        : mode === 'linked'
          ? `أي فحص ترفعيه هيظهر في ملفك عند ${dn}.`
          : null

  return (
    <>
      <h1 className="text-[22px] font-extrabold">الفحوصات</h1>
      {note && <p className="rounded-[14px] bg-brand-soft px-3.5 py-2.5 text-sm leading-[1.8] text-body">{note}</p>}
      <div className="grid grid-cols-2 gap-3">
        {TEST_SLOTS.map((t) => (
          <Slot key={t.id} id={t.id} title={t.title} sub={t.sub} />
        ))}
      </div>
      {scan || lab ? (
        <>
          <Button
            disabled={running}
            onClick={async () => {
              setRunning(true)
              setRunError('')
              setLabsNote('')
              const out = await runAnalysis()
              setRunError(out.error || '')
              setLabsNote(out.labsNote || '')
              setRunning(false)
            }}
          >
            {running ? 'النموذج بيقرا الصور…' : 'حلّلي النتائج بالذكاء الاصطناعي'}
          </Button>
          {running && <p className="text-center text-xs text-muted">أول مرة بتاخد حوالي دقيقة، علشان السيرفر بيحمّل النموذج.</p>}
          {runError && (
            <p role="alert" className="text-center text-sm font-bold text-[#A3123A]">
              {runError}
            </p>
          )}
        </>
      ) : (
        <p className="flex min-h-14 items-center justify-center rounded-[18px] bg-[#FFD6EA] px-3 text-center text-[15px] font-bold text-brand-deep">
          ارفعي ماموجرام أو سونار أو تحليل دم الأول
        </p>
      )}
      {reading && scan && <ScanSent />}
      {labsNote && lab && !labs && <LabsNote note={labsNote} onRetried={(n) => setLabsNote(n || '')} />}
      {labs && lab && <LabsReading />}
    </>
  )
}
