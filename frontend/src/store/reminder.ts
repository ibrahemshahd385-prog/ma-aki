import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ReminderState = {
  nextExam: string | null // the day of her next self-exam
  everyMonths: number // how often she wants the reminder: every month, unless she asked Wanas for longer
  setNextExam: (daysFromToday: number) => void
  setEvery: (months: number) => void
  reset: () => void
}

// Her next self-exam day and how often it comes. Wanas sets them; the home screen shows them.
// (Real phone notifications on that day come in step 18.)
export const useReminder = create<ReminderState>()(
  persist(
    (set) => ({
      nextExam: null,
      everyMonths: 1,
      setNextExam: (days) => {
        const day = new Date()
        day.setHours(9, 0, 0, 0)
        day.setDate(day.getDate() + days)
        set({ nextExam: day.toISOString() })
      },
      setEvery: (months) => set({ everyMonths: Math.min(12, Math.max(1, Math.round(months))) }),
      reset: () => set({ nextExam: null, everyMonths: 1 }),
    }),
    { name: 'maaki-reminder' },
  ),
)

// How often, in words: "كل شهر"، "كل شهرين"، "كل 3 شهور"، "كل سنة".
export function everyText(months: number) {
  if (months <= 1) return 'كل شهر'
  if (months === 2) return 'كل شهرين'
  if (months >= 12) return 'كل سنة'
  return months <= 10 ? `كل ${months} شهور` : `كل ${months} شهر`
}

// When the next one is, in words: "بعد شهرين"، "بعد 3 شهور".
export function afterText(months: number) {
  return everyText(months).replace('كل', 'بعد')
}
