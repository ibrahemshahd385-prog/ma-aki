import type { StepState } from '../components/JourneyCard'
import type { Level } from './assessment'
import type { Mode } from './clinic'

export type JourneyKey = 'assessment' | 'doctor_visit' | 'tests' | 'result' | 'follow_up' | 'monthly_self_exam'
type Journey = { key: JourneyKey; states: StepState[]; message: string }

type Input = {
  assessed: boolean
  level: Level
  mode: Mode // where she is with her doctor (see data/clinic.ts)
  doctorName: string | null
  uploads: number // how many tests she uploaded
  hasScan: boolean // a mammogram or an ultrasound is among them
  analyzed: boolean // she pressed "حلّلي النتائج"
  ordered: string[] // the tests her doctor asked for
}

// Where she is on her journey, worked out from what she has done so far.
export function journeyFor(j: Input): Journey {
  const dn = j.doctorName || 'طبيبك'
  if (!j.assessed) {
    return { key: 'assessment', states: ['current', 'todo', 'todo', 'todo', 'todo'], message: 'ابدئي بالأسئلة، وهنقولك محتاجة تكشفي ولا تطمني.' }
  }
  if (j.mode === 'follow') {
    return { key: 'follow_up', states: ['done', 'done', 'done', 'done', 'current'], message: 'التشخيص اتأكد، وخطتك في «متابعتي».' }
  }
  if (j.mode === 'routine') {
    return {
      key: 'monthly_self_exam',
      states: ['done', 'done', 'done', 'done', 'current'],
      message: 'نتيجتك مطمّنة. كمّلي الفحص الذاتي كل شهر، والفحص الدوري حسب طبيبك.',
    }
  }
  if (j.mode === 'pre' && j.level === 'low' && j.uploads === 0) {
    return {
      key: 'monthly_self_exam',
      states: ['done', 'todo', 'todo', 'todo', 'todo'],
      message: 'مفيش علامات مقلقة دلوقتي. كمّلي الفحص الذاتي كل شهر، ولو لاحظتي أي تغيير اعملي التقييم تاني.',
    }
  }

  const linked = j.mode === 'linked'
  const up = j.uploads > 0
  const states: StepState[] = ['done', linked ? 'done' : 'current', up ? 'done' : linked ? 'current' : 'todo', linked && up ? 'current' : 'todo', 'todo']

  if (j.mode === 'pre') {
    return {
      key: 'doctor_visit',
      states,
      message: up
        ? 'فحوصاتك مرفوعة. اكشفي عند دكتور واربطي حسابك بالكود، علشان يراجعها ويأكد النتيجة.'
        : 'الخطوة الجاية: كشف عند دكتور، وهو اللي يحدد الفحوصات المناسبة ليكي. في العيادة خدي الكود واربطي حسابك من تاب «الدكتور».',
    }
  }
  if (j.mode === 'pending') {
    return { key: 'doctor_visit', states, message: `طلب الربط مع ${dn} مستني الموافقة. بعدها أي فحص ترفعيه هيوصل على طول.` }
  }
  if (!up) {
    return {
      key: 'tests',
      states,
      message: j.ordered.length
        ? `الفحوصات المطلوبة: ${j.ordered.join('، ')}. اعمليها وارفعيها من تاب «الفحوصات»، وهتوصل عند ${dn} على طول.`
        : `حسابك مربوط مع ${dn}. اعملي الفحوصات اللي اتطلبت منك، وارفعيها من تاب «الفحوصات» فتوصل على طول.`,
    }
  }
  if (!j.analyzed) {
    return {
      key: 'result',
      states,
      message: j.hasScan
        ? `فحوصاتك وصلت عند ${dn}. اضغطي «حلّلي النتائج» من تاب «الفحوصات»، والنموذج هيقرا الأشعة ويبعت قراءته عنده.`
        : `تحاليلك وصلت عند ${dn}. ولما تعملي الماموجرام أو السونار ارفعيه، والنموذج هيقراه.`,
    }
  }
  return { key: 'result', states, message: `نتايجك وقراءة النموذج عند ${dn} دلوقتي، والتشخيص هيتأكد من هنا.` }
}
