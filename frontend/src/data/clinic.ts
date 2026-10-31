// The follow-up between a patient and her doctor: who they are, what they write, and the rules the app uses
// to read it (treatment plan, medicine adherence, warning signs, the doctor's summary and priority).
import { normalize } from '../lib/arabic'
import { DAY, byTime, dateOfRel, fmtAgo, plural, tOf, ymd, type DateLike, type Hours, type Timed } from '../lib/dates'
import type { Level } from './assessment'
import type { ScanReading } from '../store/tests'
import type { TestId } from './tests'

/* ---------- the people ---------- */

export type Doctor = {
  id: string
  name: string
  specialty: string
  hospital: string
  code: string // the link code printed in the clinic
  hours: Hours // when the doctor answers messages
  phone: string
  verified: boolean
  syndicateNo?: string
  demo?: boolean
  email?: string
}

export type LinkState = 'none' | 'pending' | 'active'
export type OrderId = TestId

export type Diagnosis = {
  result: 'malignant' | 'benign' | 'normal'
  stage?: string
  er?: boolean
  pr?: boolean
  her2?: boolean
  grade?: string
  confirmedAt?: string
  by?: string
}

export type StepStatus = 'done' | 'current' | 'next'
export type PlanStep = DateLike & { id: string; kind: string; title: string; status: StepStatus }
export type Appt = DateLike & { id: string; title: string }
export type Med = { id: string; name: string; dose: string; times: string[]; note?: string; since?: string }

// A file she uploaded, as her file at the clinic lists it. The file itself is in lib/files.ts.
export type SharedFile = { test: TestId; name: string; type: string; size: number; at: string; demo: boolean }

export type Patient = {
  id: string
  name: string
  age: number | null
  demo?: boolean
  link: LinkState
  doctorId: string | null
  requestedAt?: string
  linkedAt?: string
  chronic?: string[]
  // answers and chronicIds: her own answers, so the assessment comes back the same when she signs in again
  assessment?: { label: string; level: Level; factors: string[]; answers?: Record<string, number>; chronicIds?: string[] } | null
  prediction?: { birads: string; label: string; demo?: boolean; reading?: ScanReading } | null
  uploads?: string[] // names of the tests she uploaded
  files?: SharedFile[] // the files themselves, for the doctor to open
  orders?: { tests: OrderId[]; at: string; by: string } | null
  diagnosis?: Diagnosis | null
  plan?: { template: string; steps: PlanStep[] } | null
  meds?: Med[]
  appts?: Appt[]
  demoAdherence?: number // demo patients only
  updatedAt?: string
}

/* ---------- what they write ---------- */

export type Message = Timed & {
  id: string
  pid: string
  from: 'patient' | 'doctor' | 'system'
  text: string
  urgent?: boolean
  reason?: string
  readP?: boolean // read by the patient
  readD?: boolean // read by the doctor
  demo?: boolean
}
export type Symptom = Timed & {
  id: string
  pid: string
  fatigue: number // 0 to 3
  nausea: number // 0 to 3
  pain: number // 0 to 10
  temp: number | null
  mood: number // 0 to 3
  note: string
  source: string
  demo?: boolean
}
export type LabTest = 'CA 15-3' | 'WBC' | 'Hb'
export type Lab = Timed & {
  id: string
  pid: string
  test: LabTest
  value: number
  unit: string
  ref?: number | null
  low?: number | null
  source: string
  demo?: boolean
}
export type Note = Timed & { id: string; pid: string; text: string; by: string; demo?: boolean }
export type MedLog = Timed & { id: string; pid: string; medId: string; day: string; time: string }
export type Access = Timed & { id: string; pid: string; who: string; demo?: boolean }
export type Alert = Timed & {
  id: string
  pid: string
  severity: 'red' | 'yellow'
  kind: string
  text: string
  status: 'open' | 'done'
  by?: string
  closedAt?: string
  demo?: boolean
}

// Everything the doctor's screens read, besides the patients themselves.
export type Records = {
  alerts: Alert[]
  messages: Message[]
  symptoms: Symptom[]
  labs: Lab[]
  notes: Note[]
  medlogs: MedLog[]
}

/* ---------- tests the doctor can ask for ---------- */

export const ORDERABLE: OrderId[] = ['us', 'mammo', 'bio', 'lab']
export const ORDER_LABEL: Record<OrderId, string> = {
  us: 'سونار على الثدي والإبط',
  mammo: 'ماموجرام',
  bio: 'عيّنة (خزعة)',
  lab: 'تحاليل دم',
}
// The name a test gets in her file once she uploads it.
export const UPLOAD_NAME: Record<OrderId, string> = { mammo: 'ماموجرام', us: 'سونار', bio: 'تقرير عيّنة', lab: 'تحاليل دم' }

/* ---------- where she is ---------- */

// pre: not linked, pending: waiting for the doctor, linked: no diagnosis yet,
// follow: in treatment (malignant), routine: benign or normal.
export type Mode = 'pre' | 'pending' | 'linked' | 'follow' | 'routine'

export function modeOf(p: Patient | null | undefined): Mode {
  if (!p || p.link === 'none' || !p.doctorId) return 'pre'
  if (p.link === 'pending') return 'pending'
  if (!p.diagnosis) return 'linked'
  return p.diagnosis.result === 'malignant' ? 'follow' : 'routine'
}

/* ---------- the treatment plan ---------- */

export const PLAN_LABELS: Record<string, string> = {
  surgery_first: 'جراحة، ثم كيماوي، ثم إشعاع',
  neo: 'كيماوي قبل الجراحة، ثم إشعاع',
  surgery_radio: 'جراحة، ثم إشعاع',
}

// A first plan with dates counted from today; the doctor can change it afterwards.
export function buildPlan(template: string, hormonal: boolean): PlanStep[] {
  const steps: PlanStep[] = []
  let day = 7
  const add = (kind: string, title: string, gap: number) => {
    steps.push({ id: 's' + steps.length, kind, title, date: ymd(new Date(Date.now() + day * DAY)), status: 'next' })
    day += gap
  }
  const chemo = () => {
    for (let i = 1; i <= 6; i++) add('chemo', 'كيماوي: الجلسة ' + i + ' من 6', 21)
  }
  if (template === 'neo') {
    chemo()
    day += 7
    add('surgery', 'الجراحة', 35)
    add('radio', 'إشعاع', 42)
  } else if (template === 'surgery_radio') {
    add('surgery', 'الجراحة', 35)
    add('radio', 'إشعاع', 42)
  } else {
    add('surgery', 'الجراحة', 35)
    chemo()
    day += 7
    add('radio', 'إشعاع', 42)
  }
  if (hormonal) add('hormone', 'علاج هرموني', 90)
  add('followup', 'متابعة دورية', 0)
  steps[0].status = 'current'
  return steps
}

export function planInfo(p: Patient | null | undefined) {
  const steps = (p && p.plan && p.plan.steps) || []
  const ci = steps.findIndex((s) => s.status === 'current')
  return { steps, ci, cur: ci >= 0 ? steps[ci] : null, done: steps.filter((s) => s.status === 'done').length, total: steps.length }
}

export function receptorText(dx: Diagnosis | null | undefined) {
  if (!dx || dx.er == null) return ''
  return 'ER' + (dx.er ? '+' : '−') + '/PR' + (dx.pr ? '+' : '−') + '/HER2' + (dx.her2 ? '+' : '−') + '‎'
}

// One line under her name in the doctor's list.
export function dxShort(p: Patient) {
  const dx = p.diagnosis
  if (!dx) return p.link === 'pending' ? 'طلب ربط جديد' : 'في انتظار تأكيد التشخيص'
  if (dx.result === 'benign') return 'ورم حميد · متابعة دورية'
  if (dx.result === 'normal') return 'سليمة · فحص دوري'
  const cur = planInfo(p).cur
  return 'Stage ' + (dx.stage || '?') + '‎' + (cur ? ' · ' + cur.title : '')
}

/* ---------- medicines ---------- */

// The share of doses she marked as taken in the last 7 days (null when nothing was due).
export function adherence(p: Patient | null | undefined, logs: MedLog[]): number | null {
  if (!p) return null
  if (typeof p.demoAdherence === 'number') return p.demoAdherence
  const meds = p.meds || []
  const now = Date.now()
  const from = now - 7 * DAY
  let due = 0
  let taken = 0
  for (const m of meds) {
    const start = Math.max(from, m.since ? Date.parse(m.since) : from)
    for (let d = new Date(start); d.getTime() <= now + DAY; d = new Date(d.getTime() + DAY)) {
      const day = ymd(d)
      for (const tm of m.times || []) {
        const at = Date.parse(day + 'T' + tm)
        if (at >= start && at <= now) {
          due += 1
          if (logs.some((l) => l.pid === p.id && l.medId === m.id && l.day === day && l.time === tm)) taken += 1
        }
      }
    }
  }
  return due ? taken / due : null
}

/* ---------- lab results ---------- */

export const LAB_DEFS: Record<LabTest, { label: string; unit: string; ref?: number; low?: number }> = {
  'CA 15-3': { label: 'CA 15-3 (دلالات الأورام)', unit: 'U/mL', ref: 30 },
  WBC: { label: 'كرات الدم البيضاء WBC', unit: '×10³/µL', low: 4, ref: 11 },
  Hb: { label: 'الهيموجلوبين Hb', unit: 'g/dL', low: 12 },
}

// A short warning when a result is above or below its normal range, or null.
export function labFlag(l: Pick<Lab, 'test' | 'value' | 'ref' | 'low'>) {
  const def = LAB_DEFS[l.test]
  const ref = l.ref != null ? l.ref : def.ref
  const low = l.low != null ? l.low : def.low
  if (ref != null && l.value > ref) return l.test + ' ' + l.value + ' أعلى من المرجعي (' + ref + ')'
  if (low != null && l.value < low) return l.test + ' ' + l.value + ' أقل من المرجعي (' + low + ')'
  return null
}

/* ---------- symptoms ---------- */

export const LEVEL4 = ['مفيش', 'خفيف', 'متوسط', 'شديد']
export const MOODS = ['كويسة', 'عادي', 'متضايقة', 'تعبانة نفسيًا']

export type Flag = { severity: 'red' | 'yellow'; kind: string; text: string }

// Which of today's symptoms the doctor should hear about.
export function symptomFlags(s: Pick<Symptom, 'temp' | 'pain' | 'nausea' | 'fatigue' | 'mood'>): Flag[] {
  const out: Flag[] = []
  if (s.temp != null && s.temp >= 38 && s.temp <= 43) out.push({ severity: 'red', kind: 'fever', text: 'حرارة ' + s.temp.toFixed(1) })
  if (s.pain >= 7) out.push({ severity: 'red', kind: 'pain', text: 'ألم شديد ' + s.pain + ' من 10' })
  if (s.nausea >= 3) out.push({ severity: 'yellow', kind: 'nausea', text: 'غثيان شديد' })
  if (s.fatigue >= 3) out.push({ severity: 'yellow', kind: 'fatigue', text: 'تعب شديد' })
  if (s.mood >= 3) out.push({ severity: 'yellow', kind: 'mood', text: 'تعبانة نفسيًا' })
  return out
}

export function flagAdvice(kind: string) {
  if (kind === 'fever') return 'الحرارة 38 أو أكتر وإنتِ على العلاج محتاجة تتصلي بطبيبك فوراً أو تروحي أقرب طوارئ.'
  if (kind === 'pain') return 'الألم الشديد محتاج تكلّمي طبيبك النهارده.'
  if (kind === 'nausea') return 'اشربي سوايل على رشفات صغيرة، ولو مش قادرة تشربي خالص كلّمي طبيبك.'
  if (kind === 'fatigue') return 'ارتاحي النهارده، ولو التعب بيزيد كلّمي طبيبك.'
  if (kind === 'mood') return 'إحساسك مهم. ونس موجودة تسمعك، وخط الدعم النفسي 16328 أو الخط الموحد 105 شغالين 24 ساعة.'
  return ''
}

// Words in a message to the doctor that make it urgent.
const URGENT_WORDS = [
  'سخونيه', 'حراره', 'حرارت', 'رعشه', 'نزيف', 'بينزل دم', 'فيه دم', 'ضيق تنفس', 'مش قادره اتنفس', 'نهجان', 'الم شديد', 'وجع شديد',
  'اغمي', 'اغماء', 'دوخه شديده', 'ترجيع مستمر', 'مش قادره اشرب', 'ورم في دراعي', 'الم في صدري', 'انتحر', 'اموت نفسي',
]
export function urgentByWords(text: string) {
  const t = normalize(text)
  return URGENT_WORDS.some((w) => t.includes(normalize(w)))
}

/* ---------- the doctor's view of one patient ---------- */

export type Priority = { level: 0 | 1 | 2; tone: 'red' | 'yellow' | 'green'; word: string; reason: string; unread: number }

// Red: an urgent alert. Yellow: something to review. Green: stable. Used to sort the doctor's list.
export function priority(p: Patient, r: Records): Priority {
  const open = r.alerts.filter((a) => a.pid === p.id && a.status === 'open').sort(byTime)
  const red = open.filter((a) => a.severity === 'red')
  const unread = r.messages.filter((m) => m.pid === p.id && m.from === 'patient' && !m.readD).length
  const adh = adherence(p, r.medlogs)
  if (red.length) {
    const a = red[red.length - 1]
    return { level: 0, tone: 'red', word: 'تحتاج انتباه', reason: a.text + ' · ' + fmtAgo(tOf(a)), unread }
  }
  if (open.length) {
    const a = open[open.length - 1]
    return { level: 1, tone: 'yellow', word: 'مراجعة', reason: a.text + ' · ' + fmtAgo(tOf(a)), unread }
  }
  if (!p.diagnosis) {
    const up = p.uploads && p.uploads.length
    const ordered = p.orders && p.orders.tests.length
    const reason = up ? 'فحوصات مرفوعة، في انتظار تأكيد التشخيص' : ordered ? 'في انتظار الفحوصات المطلوبة' : 'محتاجة تطلبي لها فحوصات'
    return { level: 1, tone: 'yellow', word: 'مراجعة', reason, unread }
  }
  if (unread) return { level: 1, tone: 'yellow', word: 'مراجعة', reason: 'رسالة جديدة', unread }
  if (adh != null && adh < 0.8) return { level: 1, tone: 'yellow', word: 'مراجعة', reason: 'الالتزام بالأدوية ' + Math.round(adh * 100) + '%', unread }
  return { level: 2, tone: 'green', word: 'مستقرة', reason: planInfo(p).cur?.title || 'متابعة دورية', unread }
}

export type SummaryLine = { label: string; text: string; ref: string }

// The one-minute summary at the top of a patient's page, written from her data.
export function ruleSummary(p: Patient, r: Records): SummaryLine[] {
  const lines: SummaryLine[] = []
  const pi = planInfo(p)
  const dx = p.diagnosis
  if (dx && dx.result === 'malignant') {
    lines.push({
      label: 'التشخيص',
      text: ['Stage ' + (dx.stage || '?'), receptorText(dx), pi.cur ? pi.cur.title : null].filter(Boolean).join(' · '),
      ref: 'plan',
    })
  } else if (dx) {
    lines.push({ label: 'التشخيص', text: dx.result === 'benign' ? 'ورم حميد · متابعة دورية' : 'سليمة · فحص دوري', ref: 'plan' })
  } else {
    const waiting = p.orders && p.orders.tests.length && !(p.uploads && p.uploads.length)
    if (waiting && p.orders) {
      lines.push({ label: 'الحالة', text: 'في انتظار الفحوصات المطلوبة: ' + p.orders.tests.map((id) => ORDER_LABEL[id]).join('، '), ref: 'orders' })
    } else if (!(p.uploads && p.uploads.length)) {
      lines.push({ label: 'الحالة', text: 'لسه ما اتطلبش فحوصات', ref: 'orders' })
    } else {
      lines.push({ label: 'الحالة', text: 'في انتظار تأكيد التشخيص · ' + (p.prediction ? p.prediction.birads : 'لسه مفيش تحليل'), ref: 'files' })
    }
  }

  const syms = r.symptoms.filter((s) => s.pid === p.id && tOf(s) >= Date.now() - 14 * DAY)
  if (syms.length) {
    const temps = syms.map((s) => Number(s.temp)).filter((x) => x >= 34 && x <= 43)
    const pains = syms.map((s) => Number(s.pain) || 0)
    const avgPain = pains.reduce((a, b) => a + b, 0) / pains.length
    const nauseaDays = syms.filter((s) => Number(s.nausea) >= 2).length
    const parts: string[] = []
    if (temps.length) parts.push('أعلى حرارة ' + Math.max(...temps).toFixed(1))
    parts.push('متوسط الألم ' + avgPain.toFixed(1) + ' من 10')
    if (nauseaDays) parts.push('غثيان متوسط أو أكتر في ' + plural(nauseaDays, 'يوم', 'يومين', 'أيام', 'يوم'))
    lines.push({ label: 'آخر أسبوعين', text: parts.join('، '), ref: 'symptoms' })
  } else {
    lines.push({ label: 'آخر أسبوعين', text: 'مفيش أعراض مسجّلة', ref: 'symptoms' })
  }

  const adh = adherence(p, r.medlogs)
  if (adh != null) lines.push({ label: 'الأدوية', text: 'الالتزام آخر 7 أيام ' + Math.round(adh * 100) + '%', ref: 'meds' })

  const labs = r.labs.filter((l) => l.pid === p.id && l.test === 'CA 15-3').sort(byTime)
  if (labs.length) {
    const f = labs[0]
    const l = labs[labs.length - 1]
    const trend = labs.length > 1 ? 'من ' + f.value + ' لـ ' + l.value + ' (' + (l.value > f.value ? 'طالع' : 'نازل') + ')' : String(l.value)
    lines.push({ label: 'CA 15-3', text: trend + (labFlag(l) ? ' · أعلى من المرجعي' : ''), ref: 'labs' })
  }

  const open = r.alerts.filter((a) => a.pid === p.id && a.status === 'open')
  if (open.length) lines.push({ label: 'يحتاج انتباه', text: open.map((a) => a.text).join('، '), ref: 'alerts' })

  const lastQ = r.messages.filter((m) => m.pid === p.id && m.from === 'patient').sort(byTime).pop()
  if (lastQ) lines.push({ label: 'آخر رسالة منها', text: lastQ.text.slice(0, 110), ref: 'messages' })
  return lines
}

// Appointments in order, each with its time in milliseconds.
export function apptsOf(p: Patient | null | undefined) {
  return (p?.appts || []).map((a) => ({ ...a, t: dateOfRel(a).getTime() })).sort((a, b) => a.t - b.t)
}
