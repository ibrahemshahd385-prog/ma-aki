import { Navigate, useNavigate } from 'react-router'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { LEVELS } from '../data/assessment'
import { useAssessment, useResult } from '../store/assessment'

const CARD = 'flex flex-col rounded-3xl bg-white px-5 py-[18px] shadow-[0_6px_22px_rgba(224,23,127,0.08)]'

export function Result() {
  const navigate = useNavigate()
  const done = useAssessment((s) => s.done)
  const result = useResult()

  // Nothing to show before she answers the questions.
  if (!done) return <Navigate to="/assess" replace />

  const level = LEVELS[result.level]

  return (
    <>
      <h1 className="text-[22px] font-extrabold">نتيجة التقييم</h1>

      <section className={CARD + ' gap-3.5'}>
        <p className="text-[13px] text-muted">مستوى الاحتمالية</p>
        {/* The colours change with the result, so they go in style instead of a class. */}
        <p className="text-[26px] font-extrabold" style={{ color: level.color }}>
          {level.label}
        </p>
        <div className="h-3.5 overflow-hidden rounded-full bg-[#FFD6EA]">
          <div className="h-3.5 rounded-full motion-safe:animate-fill" style={{ width: level.width, background: level.color }} />
        </div>
        <div className="flex justify-between text-xs text-muted">
          <span>منخفض</span>
          <span>متوسط</span>
          <span>مرتفع</span>
        </div>
        <p className="text-[15px] leading-[1.8] text-body">{level.message}</p>
      </section>

      {result.factors.length > 0 && (
        <section className={CARD + ' gap-2.5'}>
          <h2 className="text-[15px] font-extrabold">العوامل اللي أثرت على النتيجة</h2>
          <ul className="flex flex-col gap-2">
            {result.factors.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm leading-[1.7]">
                <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-brand" />
                {f}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.level === 'low' ? (
        <Button onClick={() => navigate('/home')}>رجوع للفحص الشهري</Button>
      ) : (
        <Button onClick={() => navigate('/doctor')}>روحي لصفحة الدكتور</Button>
      )}
      {/* Wanas will read this question when we build it in step 7. */}
      <Button variant="outline" onClick={() => navigate('/chat', { state: { ask: 'اشرحيلي نتيجتي' } })}>
        <Icon name="chat" size={20} color="#E0177F" />
        اسألي ونس عن نتيجتك
      </Button>
      <Button variant="soft" onClick={() => navigate('/assess')}>
        أعيدي التقييم
      </Button>
      <p className="text-center text-xs leading-[1.7] text-muted">
        التقييم ده للتوعية وتحديد الأولوية، ومش تشخيص. التشخيص بيكون بالأشعة والطبيب.
      </p>
    </>
  )
}