import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { LEVELS, scoreAssessment } from '../data/assessment'
import { useNotifications } from './notifications'

type AssessmentState = {
  name: string
  age: string
  chronic: string[] // ids from CHRONIC
  answers: Record<string, number> // question id -> the number of the chosen option
  done: boolean // she finished the questions at least once
  setName: (name: string) => void
  setAge: (age: string) => void
  toggleChronic: (id: string) => void
  answer: (questionId: string, option: number) => void
  finish: () => void
  reset: () => void
}

const EMPTY = { name: '', age: '', chronic: [] as string[], answers: {} as Record<string, number>, done: false }

// Her answers, kept in the browser like the sign-in.
export const useAssessment = create<AssessmentState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      setName: (name) => set({ name }),
      setAge: (age) => set({ age }),
      toggleChronic: (id) =>
        set((s) => {
          // "لا يوجد" clears the others, and choosing any other one clears "لا يوجد".
          if (id === 'none') return { chronic: s.chronic.includes('none') ? [] : ['none'] }
          const rest = s.chronic.filter((c) => c !== 'none')
          return { chronic: rest.includes(id) ? rest.filter((c) => c !== id) : [...rest, id] }
        }),
      answer: (questionId, option) => set((s) => ({ answers: { ...s.answers, [questionId]: option } })),
      finish: () => {
        set({ done: true })
        // A notification with the result, under the bell.
        const { age, chronic, answers } = get()
        const level = scoreAssessment(age, chronic, answers).level
        useNotifications
          .getState()
          .add(
            'نتيجة التقييم: ' + LEVELS[level].label,
            level === 'low'
              ? 'خدتي أول خطوة، ودي أهم خطوة. كمّلي الفحص الذاتي كل شهر.'
              : 'الخطوة الجاية في صفحة «الدكتور»: الكشف، وأماكن الكشف المجاني.',
          )
      },
      reset: () => set(EMPTY),
    }),
    { name: 'maaki-assessment' },
  ),
)

// Her result, worked out again from her answers whenever they change.
export function useResult() {
  const { age, chronic, answers } = useAssessment()
  return scoreAssessment(age, chronic, answers)
}
