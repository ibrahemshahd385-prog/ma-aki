import { Icon } from './Icon'

export type StepState = 'done' | 'current' | 'todo'

const STEPS = ['الأسئلة', 'الدكتور', 'الفحوصات', 'النتيجة', 'المتابعة']

// Read out by screen readers after each step's name.
const SAID: Record<StepState, string> = { done: ' (خلصت)', current: ' (الخطوة الحالية)', todo: '' }

type Props = { states: StepState[]; message: string }

// The patient's path through the app: questions, doctor, tests, result, follow-up.
export function JourneyCard({ states, message }: Props) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-white px-5 py-[18px] shadow-[0_6px_22px_rgba(224,23,127,0.08)]">
      <h2 className="flex items-center gap-2 text-[19px] font-extrabold text-brand">
        <Icon name="compass" color="#E0177F" stroke={2.2} />
        رحلتك
      </h2>
      <ol className="grid grid-cols-5 gap-0.5 text-center">
        {STEPS.map((label, i) => {
          const s = states[i] ?? 'todo'
          const circle =
            s === 'todo' ? 'bg-brand-soft text-brand-deep' : 'bg-brand text-white' + (s === 'current' ? ' shadow-[0_0_0_5px_#FFD1E6]' : '')
          const text = s === 'current' ? 'font-extrabold text-brand-deep' : s === 'done' ? 'font-semibold text-ink' : 'font-semibold text-muted'
          return (
            <li key={label} className="flex min-w-0 flex-col items-center gap-2">
              <span
                aria-hidden="true"
                className={'flex size-[34px] items-center justify-center rounded-full text-[15px] font-extrabold ' + circle}
              >
                {s === 'done' ? <Icon name="check" size={16} color="#FFFFFF" stroke={3} /> : i + 1}
              </span>
              <span className={'text-xs leading-snug ' + text}>
                {label}
                {SAID[s] && <span className="sr-only">{SAID[s]}</span>}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="text-sm leading-[1.8] text-muted">{message}</p>
    </section>
  )
}