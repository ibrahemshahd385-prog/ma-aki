import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../components/Button'
import { Card, CardTitle } from '../components/Card'
import { DoctorPhone } from '../components/DoctorPhone'
import { Icon } from '../components/Icon'
import { LEVELS } from '../data/assessment'
import { HOTLINES, likelyTests } from '../data/care'
import { ORDER_LABEL, UPLOAD_NAME, type Doctor as DoctorInfo, type OrderId } from '../data/clinic'
import { fmtAgo, hoursText } from '../lib/dates'
import { useAssessment, useResult } from '../store/assessment'
import { cancelLink, findDoctorAsync, requestLink, useMode, useMyDoctor, useMyRecord } from '../store/doctor'
import { useTests } from '../store/tests'
import { toast } from '../store/toast'

const TEXT = 'text-[15px] leading-[1.8] text-body'
const NOTE = 'rounded-[14px] bg-app px-3 py-2.5 text-sm leading-[1.8]'

// The doctor's name and where they work, with a box icon.
function DoctorBadge({ doctor }: { doctor: DoctorInfo }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-[52px] shrink-0 items-center justify-center rounded-[18px] bg-brand-soft">
        <Icon name="doctor" size={26} color="#E0177F" />
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-extrabold">{doctor.name}</p>
        <p className="text-xs leading-relaxed text-muted">{[doctor.specialty, doctor.hospital].filter(Boolean).join(' · ')}</p>
        {(doctor.verified || doctor.demo) && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {doctor.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF7EE] px-2.5 py-0.5 text-xs font-extrabold text-[#1E6B34]">
                <Icon name="check" size={14} color="#1E6B34" stroke={3} />
                حساب موثّق
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Before linking: the code from the clinic, then her consent. This sends a request the doctor accepts in the dashboard.
function LinkCard() {
  const [code, setCode] = useState('')
  const [found, setFound] = useState<DoctorInfo | null>(null)
  const [error, setError] = useState('')

  async function search() {
    if (!code.trim()) {
      setError('اكتبي الكود اللي خدتيه من العيادة.')
      return
    }
    const d = await findDoctorAsync(code)
    if (!d) {
      setError('الكود ده مش موجود. اتأكدي منه مع العيادة.')
      return
    }
    setFound(d)
  }

  function confirm(d: DoctorInfo) {
    requestLink(d)
    setFound(null)
    setCode('')
    toast('طلب الربط اتبعت')
  }

  return (
    <Card>
      <CardTitle icon="link">اربطي حسابك بطبيبك</CardTitle>
      {found ? (
        <>
          <DoctorBadge doctor={found} />
          <p className={TEXT}>
            لو وافقتي، بياناتك ونتيجة التقييم والفحوصات وقراءتها، والأعراض والرسائل، هتظهر عند {found.name}. وتقدري تلغي الربط في أي وقت.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="solid" onClick={() => confirm(found)}>
              أوافق وأربط
            </Button>
            <Button variant="small" onClick={() => setFound(null)}>
              إلغاء
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className={TEXT}>في الكشف خدي الكود من العيادة. بعد الربط، طبيبك هيشوف تقييمك والفحوصات اللي ترفعيها، ويأكد التشخيص ويتابع معاكِ من هنا.</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              search()
            }}
          >
            <label htmlFor="code" className="sr-only">
              كود الطبيب
            </label>
            <input
              id="code"
              dir="ltr"
              autoComplete="off"
              placeholder="MK-0000"
              value={code}
              onChange={(e) => {
                const val = e.target.value
                setCode(val)
                setError('')
                if (val.trim().length >= 4) {
                  findDoctorAsync(val).catch(() => {})
                }
              }}
              className="h-11 min-w-0 flex-1 rounded-[14px] border-[1.5px] border-brand-line bg-white px-3.5 text-center text-base tracking-wider outline-brand focus:outline-2 focus:outline-offset-1"
            />
            <Button type="submit" variant="solid">
              ربط
            </Button>
          </form>
          {error && (
            <p role="alert" className="text-sm font-bold text-[#A3123A]">
              {error}
            </p>
          )}
          <p className="text-xs leading-relaxed text-muted">اكتبي الكود الذي يمنحه لكِ طبيبكِ في العيادة.</p>
        </>
      )}
    </Card>
  )
}

// After the request: her doctor, where things stand, and the buttons for the next step.
function MyDoctorCard() {
  const navigate = useNavigate()
  const mode = useMode()
  const doctor = useMyDoctor()
  const record = useMyRecord()
  const localUploads = useTests((s) => Object.keys(s.uploads).length)
  const [askCancel, setAskCancel] = useState(false)
  if (!doctor) return null

  const pending = mode === 'pending'
  const hasFiles = localUploads > 0 || !!(record && record.uploads && record.uploads.length)
  const benign = record?.diagnosis?.result === 'benign'

  function cancel() {
    cancelLink()
    setAskCancel(false)
    toast(pending ? 'طلب الربط اتلغى' : 'الربط اتلغى')
  }

  return (
    <Card>
      <DoctorBadge doctor={doctor} />
      {pending && (
        <p className={NOTE}>
          <b>طلب الربط اتبعت.</b> مستني موافقة {doctor.name}.
        </p>
      )}
      {mode === 'linked' && (
        <p className={NOTE}>
          {hasFiles
            ? 'حسابك مربوط. نتايجك بتتراجع، والتشخيص هيتأكد من هنا.'
            : 'حسابك مربوط. لما تعملي الفحوصات ارفعيها من تاب «الفحوصات»، وهتوصل على طول.'}
        </p>
      )}
      {mode === 'routine' && (
        <p className="rounded-[14px] bg-[#EAF7EE] px-3 py-2.5 text-sm leading-[1.8]">اتأكد إن نتيجتك {benign ? 'ورم حميد' : 'سليمة'}.</p>
      )}
      {mode === 'follow' && <p className={NOTE}>التشخيص اتأكد، وخطتك في «متابعتي».</p>}
      <DoctorPhone doctor={doctor} />
      {!pending && <p className="text-xs leading-relaxed text-muted">الرد على الرسائل {hoursText(doctor.hours)}</p>}
      <div className="flex flex-wrap gap-2">
        {mode === 'follow' && (
          <Button variant="solid" onClick={() => navigate('/follow')}>
            متابعتي
          </Button>
        )}
        {!pending && (
          <Button variant="solid" onClick={() => navigate('/messages')}>
            الرسائل
          </Button>
        )}
        {askCancel ? (
          <>
            <Button variant="small" onClick={cancel}>
              {pending ? 'أيوه، الغي الطلب' : 'أيوه، الغي الربط'}
            </Button>
            <Button variant="soft" onClick={() => setAskCancel(false)}>
              رجوع
            </Button>
          </>
        ) : (
          <Button variant="soft" onClick={() => setAskCancel(true)}>
            {pending ? 'إلغاء الطلب' : 'إلغاء الربط'}
          </Button>
        )}
      </div>
    </Card>
  )
}

// The tests: the ones her doctor asked for (with a tick once uploaded), or the ones a doctor usually asks for.
function TestsCard() {
  const mode = useMode()
  const record = useMyRecord()
  const doctor = useMyDoctor()
  const age = useAssessment((s) => s.age)
  const uploads = useTests((s) => s.uploads)
  const orders = mode === 'linked' && record && record.orders ? record.orders : null
  const isUp = (id: OrderId) => !!uploads[id] || !!record?.uploads?.includes(UPLOAD_NAME[id])

  return (
    <Card>
      <CardTitle icon="assess">{orders ? 'الفحوصات المطلوبة' : 'الفحوصات اللي غالبًا هتحتاجيها'}</CardTitle>
      {orders ? (
        <>
          <p className="text-sm text-muted">
            من {doctor ? doctor.name : 'طبيبك'} · {fmtAgo(Date.parse(orders.at))}
          </p>
          <ul className="flex flex-col gap-2.5">
            {orders.tests.map((id) => {
              const done = isUp(id)
              return (
                <li key={id} className="flex items-center gap-2.5 text-[15px] leading-relaxed">
                  <span
                    aria-hidden="true"
                    className={
                      'flex size-6 shrink-0 items-center justify-center rounded-lg border-2 ' +
                      (done ? 'border-[#1E6B34] bg-[#1E6B34]' : 'border-brand-line bg-white')
                    }
                  >
                    {done && <Icon name="check" size={14} color="#FFFFFF" stroke={3} />}
                  </span>
                  <span className="min-w-0 flex-1">{ORDER_LABEL[id]}</span>
                  <span className="text-xs text-muted">{done ? 'اترفع' : 'لسه'}</span>
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">
            {likelyTests(age).map((t) => (
              <li key={t} className="flex items-center gap-2.5 text-base">
                <span aria-hidden="true" className="size-1.5 shrink-0 bg-ink" />
                {t}
              </li>
            ))}
          </ul>
          <p className="text-sm leading-[1.7] text-muted">
            {mode === 'linked'
              ? 'اعملي اللي طلبه طبيبك وارفعيه من تاب «الفحوصات»، وهيوصل على طول.'
              : 'الدكتور هو اللي يحددها في الكشف. ولو معاكِ أشعة عملتيها قبل كده، ارفعيها، والدكتور هيلاقيها في ملفك بعد الربط.'}
          </p>
        </>
      )}
    </Card>
  )
}

export function Doctor() {
  const navigate = useNavigate()
  const name = useAssessment((s) => s.name.trim()) || 'جميلة'
  const done = useAssessment((s) => s.done)
  const result = useResult()
  const mode = useMode()
  const needsDoctor = done && result.level !== 'low'
  const showTests = (mode === 'pre' && needsDoctor) || mode === 'pending' || mode === 'linked'

  // Opens Wanas with a question ready.
  const ask = (question: string) => navigate('/chat', { state: { ask: question } })

  return (
    <>
      <Card>
        <CardTitle icon="heart">أهلاً يا {name}</CardTitle>
        <p className="text-[17px]">
          <b className="font-extrabold">التقييم الأولي:</b> {done ? LEVELS[result.level].label : 'لسه ما اتعملش'}
        </p>
        {!done && (
          <Button variant="small" className="self-start" onClick={() => navigate('/assess')}>
            ابدئي التقييم
          </Button>
        )}
      </Card>

      {mode === 'pre' && needsDoctor && (
        <Card>
          <CardTitle icon="doctor">خطوتك الجاية: كشف عند دكتور</CardTitle>
          <p className={TEXT}>
            الدكتور بيكشف الأول، وهو اللي يحدد الفحوصات المناسبة ليكي
            {result.level === 'urgent' ? '، ويُفضّل يكون الكشف خلال أسبوعين' : ''}.
          </p>
          <ol className="flex flex-col gap-2">
            {['اكشفي عند دكتور', 'خدي الكود من العيادة واربطي حسابك', 'اعملي الفحوصات اللي طلبها وارفعيها هنا'].map((t, i) => (
              <li key={t} className="flex items-center gap-2.5 text-[15px] leading-relaxed font-bold">
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-extrabold text-brand-deep"
                >
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button variant="solid" onClick={() => ask('حضّريلي أسئلة للدكتور')}>
              حضّريلي للزيارة
            </Button>
            <Button variant="small" onClick={() => ask('فين أكشف ببلاش؟')}>
              فين أكشف ببلاش؟
            </Button>
          </div>
        </Card>
      )}

      {mode === 'pre' && done && !needsDoctor && (
        <Card tone="green">
          <CardTitle icon="check" green>
            مش محتاجة كشف دلوقتي
          </CardTitle>
          <p className={TEXT}>
            كمّلي الفحص الذاتي كل شهر، ولو لاحظتي أي تغيير اعملي التقييم تاني. ولو كشفتي عند دكتور للاطمئنان، تقدري تربطي حسابك بالكود.
          </p>
        </Card>
      )}

      {mode === 'pre' ? <LinkCard /> : <MyDoctorCard />}

      {showTests && (
        <>
          <TestsCard />
          <Button onClick={() => navigate('/tests')}>
            رفع الفحوصات
            <Icon name="upload" color="#FFFFFF" stroke={2.4} />
          </Button>
        </>
      )}

      {mode === 'pre' && (
        <Card>
          <CardTitle icon="phone">كشف مجاني</CardTitle>
          {HOTLINES.map((h) => (
            <div key={h.number} className="flex flex-col gap-1.5">
              <p className="text-sm leading-[1.7] text-body">
                <b className="text-ink">{h.label}:</b> {h.note}
              </p>
              <a
                href={`tel:${h.number}`}
                className="inline-flex min-h-11 items-center gap-2 self-start rounded-[14px] bg-brand-soft px-3.5 text-[15px] font-extrabold text-brand-deep"
              >
                <Icon name="phone" size={18} color="#B80F68" stroke={2.2} />
                <span dir="ltr">{h.number}</span>
              </a>
            </div>
          ))}
        </Card>
      )}
    </>
  )
}
