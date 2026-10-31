import { useState } from 'react'
import { SELF_EXAM_STEPS as STEPS } from '../data/selfExam'
import { Icon } from './Icon'

// The monthly self-exam, one step at a time, with a small moving drawing for each step.
export function SelfExamCard() {
  const [step, setStep] = useState(0)
  const count = STEPS.length
  const current = STEPS[step]

  // Moves forward or back, and wraps around from the last step to the first.
  function go(delta: number) {
    setStep((step + delta + count) % count)
  }

  return (
    <section
      aria-label="خطوات الفحص الذاتي"
      className="flex flex-col gap-3.5 rounded-3xl bg-white p-[18px] shadow-[0_6px_24px_rgba(224,23,127,0.08)]"
    >
      <div className="relative h-[210px] overflow-hidden rounded-[18px] bg-brand-soft">
        <div className="absolute top-1 left-1/2 h-[200px] w-[220px] -translate-x-1/2">
          <svg width="220" height="200" viewBox="0 0 220 200" aria-hidden="true">
            <path
              d="M20 200 C22 120 30 60 62 40 C80 30 92 24 96 6 M200 200 C198 120 190 60 158 40 C140 30 128 24 124 6"
              fill="none"
              stroke="#E0177F"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path d="M96 6 C100 18 120 18 124 6" fill="none" stroke="#E0177F" strokeWidth="3" strokeLinecap="round" />
            <circle cx="76" cy="112" r="34" fill="#FFFFFF" stroke="#E0177F" strokeWidth="3" />
            <circle cx="144" cy="112" r="34" fill="#FFFFFF" stroke="#E0177F" strokeWidth="3" />
            <circle cx="76" cy="114" r="3" fill="#E0177F" />
            <circle cx="144" cy="114" r="3" fill="#E0177F" />
          </svg>

          {step < 2 ? (
            // Steps 1 and 2 are about looking: a line scans down and up.
            <div className="absolute inset-x-2.5 top-6 h-[3px] rounded-full bg-brand shadow-[0_0_14px_#FF4FA0] motion-safe:animate-scan" />
          ) : (
            // Steps 3 to 5 are about touch: a dot circles the spot to press.
            <div className={'absolute ' + (step === 3 ? 'top-[46px] left-5 size-10' : 'top-[78px] left-[42px] size-[68px]')}>
              <div className="absolute inset-0 rounded-full border-2 border-[#FF4FA0] motion-safe:animate-ring-pulse" />
              <div className="absolute inset-0 motion-safe:animate-orbit">
                <div className="absolute -top-[9px] left-1/2 size-[18px] -translate-x-1/2 rounded-full border-[3px] border-white bg-brand shadow-[0_2px_8px_rgba(58,16,39,0.3)]" />
              </div>
            </div>
          )}
        </div>
        <div className="absolute top-2.5 right-2.5 rounded-[10px] bg-white px-2.5 py-1 text-xs font-extrabold text-brand">
          خطوة {step + 1} من {count}
        </div>
      </div>

      <div aria-live="polite">
        <h2 className="text-[19px] font-extrabold">{current.title}</h2>
        <p className="mt-1.5 text-[15px] leading-[1.75] text-body">{current.text}</p>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="الخطوة السابقة"
          onClick={() => go(-1)}
          className="flex size-11 items-center justify-center rounded-[14px] border-[1.5px] border-brand-line bg-white"
        >
          <Icon name="prev" size={20} color="#E0177F" stroke={2.5} />
        </button>
        <div className="flex gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s.title} className={'h-2 rounded-full ' + (i === step ? 'w-[22px] bg-brand' : 'w-2 bg-brand-line')} />
          ))}
        </div>
        <button
          type="button"
          aria-label="الخطوة التالية"
          onClick={() => go(1)}
          className="flex size-11 items-center justify-center rounded-[14px] bg-brand"
        >
          <Icon name="next" size={20} color="#FFFFFF" stroke={2.5} />
        </button>
      </div>
    </section>
  )
}
