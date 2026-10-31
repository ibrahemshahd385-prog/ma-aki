import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { CHRONIC, QUESTIONS } from '../data/assessment'
import { useAssessment } from '../store/assessment'

const INPUT =
  'h-[50px] w-full rounded-[14px] border-[1.5px] border-brand-line bg-white px-3.5 text-base outline-brand focus:outline-2 focus:outline-offset-1'

// Keeps numbers only, and turns Arabic digits into normal ones (٣٥ becomes 35).
function onlyDigits(text: string) {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '')
    .slice(0, 3)
}

export function Assess() {
  const navigate = useNavigate()
  const a = useAssessment()
  const [page, setPage] = useState(0) // page 0 is her details, then one page for each question
  const total = QUESTIONS.length + 1
  const question = page > 0 ? QUESTIONS[page - 1] : null
  const chosen = question ? a.answers[question.id] : undefined
  const isLast = page === total - 1

  function next() {
    if (!isLast) {
      setPage(page + 1)
      return
    }
    a.finish()
    navigate('/assess/result')
  }

  function back() {
    if (page === 0) navigate('/home')
    else setPage(page - 1)
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-[13px] text-muted">
          <span>تقييم الاحتمالية</span>
          <span dir="ltr">
            {page + 1} / {total}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#FFD6EA]">
          <div
            className="h-2 rounded-full bg-brand transition-[width] duration-300"
            style={{ width: `${Math.round(((page + 1) / total) * 100)}%` }}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3.5">
        {question ? (
          <>
            <h1 className="text-[21px] leading-normal font-extrabold">{question.text}</h1>
            {question.hint && <p className="text-sm leading-[1.7] text-muted">{question.hint}</p>}
            <div className="flex flex-col gap-2.5">
              {question.options.map((o, i) => {
                const on = chosen === i
                return (
                  <button
                    key={o.label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => a.answer(question.id, i)}
                    className={
                      'flex min-h-14 items-center justify-between gap-2.5 rounded-2xl px-4 py-3 text-start text-[15px] ' +
                      (on ? 'border-2 border-brand bg-brand-soft font-bold' : 'border-[1.5px] border-brand-line bg-white font-semibold')
                    }
                  >
                    <span>{o.label}</span>
                    {on && <Icon name="check" size={20} color="#E0177F" stroke={3} />}
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <h1 className="text-[22px] font-extrabold">بياناتك</h1>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-sm font-bold">
                الاسم
              </label>
              <input
                id="name"
                type="text"
                autoComplete="given-name"
                placeholder="اكتبي اسمك"
                value={a.name}
                onChange={(e) => a.setName(e.target.value)}
                className={INPUT}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="age" className="text-sm font-bold">
                السن
              </label>
              <input
                id="age"
                type="text"
                inputMode="numeric"
                placeholder="مثلاً 35"
                value={a.age}
                onChange={(e) => a.setAge(onlyDigits(e.target.value))}
                className={INPUT}
              />
            </div>
            <p className="text-sm font-bold">
              عندك أمراض مزمنة أو عادات؟ <span className="font-normal text-muted">(اختاري كل اللي ينطبق)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {CHRONIC.map((c) => {
                const on = a.chronic.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => a.toggleChronic(c.id)}
                    className={
                      'min-h-11 rounded-full border-[1.5px] px-4 text-sm ' +
                      (on ? 'border-brand bg-brand font-bold text-white' : 'border-brand-line bg-white font-semibold text-ink')
                    }
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      <div className="flex gap-2.5">
        <Button variant="soft" onClick={back}>
          رجوع
        </Button>
        {/* On a question page, "next" waits until she picks an answer. */}
        <Button onClick={next} disabled={question !== null && chosen === undefined} className="flex-1">
          {isLast ? 'حلّلي إجاباتي' : 'التالي'}
        </Button>
      </div>
    </div>
  )
}