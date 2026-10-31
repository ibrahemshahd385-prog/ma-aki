import { buildPlan, ORDER_LABEL, planInfo, type Alert, type Diagnosis, type Doctor, type OrderId, type Patient } from '../data/clinic'
import { clinicFetch } from '../lib/api'
import { DEMO_DOCTOR_ID } from '../data/seed'
import { normalize } from '../lib/arabic'
import { isoNow } from '../lib/dates'
import { deleteFilesOf } from '../lib/files'
import { doctorIdOf, useAuth } from './auth'
import { listOf, loadSavedDoctors, resetLive, useClinic } from './clinic'
import { toast } from './toast'

// Default fallback ID (د. سارة عادل, code MK-4821)
export const DOC_ID = DEMO_DOCTOR_ID

export function getCurrentDoctorId(): string {
  const user = useAuth.getState().user
  const id = doctorIdOf(user)
  if (!id) return DEMO_DOCTOR_ID
  const doctors = useClinic.getState().doctors
  if (doctors[id]) return id
  if (user?.email) {
    const cleanEmail = user.email.toLowerCase().trim()
    const byEmail = Object.values(doctors).find((d) => d.email && d.email.toLowerCase().trim() === cleanEmail)
    if (byEmail) return byEmail.id
  }
  return id
}

export function getCurrentDoctor(): Doctor | null {
  const id = getCurrentDoctorId()
  const doctors = useClinic.getState().doctors
  if (doctors[id]) return doctors[id]
  const user = useAuth.getState().user
  if (user?.email) {
    const cleanEmail = user.email.toLowerCase().trim()
    const byEmail = Object.values(doctors).find((d) => d.email && d.email.toLowerCase().trim() === cleanEmail)
    if (byEmail) return byEmail

    try {
      const raw = localStorage.getItem('maaki_doctor_email_' + cleanEmail)
      if (raw) {
        const parsed = JSON.parse(raw) as Doctor
        if (parsed?.id) {
          useClinic.setState((s) => ({ doctors: { ...s.doctors, [parsed.id]: parsed } }))
          return parsed
        }
      }
      const saved = loadSavedDoctors()
      if (saved[id]) {
        useClinic.setState((s) => ({ doctors: { ...s.doctors, [id]: saved[id] } }))
        return saved[id]
      }
      const savedByEmail = Object.values(saved).find((d) => d.email && d.email.toLowerCase().trim() === cleanEmail)
      if (savedByEmail) {
        useClinic.setState((s) => ({ doctors: { ...s.doctors, [savedByEmail.id]: savedByEmail } }))
        return savedByEmail
      }
    } catch {}
  }
  return null
}

export function generateUniqueDoctorCode(): string {
  const existing = Object.values(useClinic.getState().doctors).map((d) => d.code.toUpperCase().replace(/[^A-Z0-9]/g, ''))
  const set = new Set(existing)
  for (let i = 0; i < 200; i++) {
    const num = Math.floor(1000 + Math.random() * 9000)
    const code = `MK-${num}`
    if (!set.has(`MK${num}`)) return code
  }
  return `MK-${Math.floor(10000 + Math.random() * 90000)}`
}

// His profile goes to the clinic server, so he is the same doctor (same name and link code) on every device.
export function sendDoctorToServer(doc: Doctor) {
  if (typeof window === 'undefined') return
  clinicFetch('/api/clinic/doctors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  }).catch(() => {})
}

export function saveDoctorProfile(profile: {
  id?: string
  name: string
  specialty: string
  hospital: string
  code: string
  hours?: { from: number; to: number }
  phone?: string
  syndicateNo?: string
  email?: string
}): Doctor {
  const user = useAuth.getState().user
  const id = profile.id || getCurrentDoctorId()
  const current = useClinic.getState().doctors[id]
  const cleanCode = (profile.code || generateUniqueDoctorCode()).trim().toUpperCase()
  const email = (profile.email || user?.email || '').trim().toLowerCase()

  const doc: Doctor = {
    id,
    name: profile.name.trim(),
    specialty: profile.specialty.trim() || 'جراحة وأورام الثدي',
    hospital: profile.hospital.trim() || 'عيادة خاصة',
    code: cleanCode,
    hours: profile.hours || current?.hours || { from: 10, to: 16 },
    phone: profile.phone !== undefined ? profile.phone.trim() : (current?.phone ?? ''),
    verified: true,
    syndicateNo: profile.syndicateNo?.trim() || current?.syndicateNo || '',
    demo: false,
    email,
  }

  useClinic.getState().put('doctors', doc)
  if (email) {
    try {
      localStorage.setItem('maaki_doctor_email_' + email, JSON.stringify(doc))
    } catch {}
  }

  // مزامنة فورية مع السيرفر المركزي حتى يظهر الكود لكل الأجهزة فوراً
  sendDoctorToServer(doc)

  toast('تم حفظ بيانات الطبيب بنجاح')
  return doc
}

const clinic = () => useClinic.getState()
const doctorName = () => getCurrentDoctor()?.name || clinic().doctors[DOC_ID]?.name || 'طبيبك'

// A message from the doctor to the patient.
function say(pid: string, text: string) {
  clinic().add('messages', { pid, from: 'doctor', text: text.slice(0, 1000), at: isoNow(), readP: false, readD: true })
}

function closeLinkAlerts(pid: string) {
  const open = listOf<'alerts'>(clinic().alerts).filter((a) => a.pid === pid && a.kind === 'link' && a.status === 'open')
  clinic().updateMany('alerts', open.map((a) => a.id), { status: 'done' })
}

/* ---------- link requests ---------- */

export function accept(p: Patient) {
  const at = isoNow()
  clinic().update('patients', p.id, { link: 'active', linkedAt: at, updatedAt: at })
  closeLinkAlerts(p.id)
  const hasFiles = !!(p.uploads && p.uploads.length)
  say(
    p.id,
    'أهلاً يا ' + (p.name || '') + '، أنا ' + (doctorName() || 'طبيبك') + '. ' +
      (hasFiles ? 'وصلتني نتايجك، وهراجعها وأرد عليكِ هنا.' : 'هطلب لك الفحوصات المناسبة من هنا، ولما تعمليها ارفعيها وهتوصلني على طول.'),
  )
  toast('اتقبل طلب الربط')
}

export function decline(p: Patient) {
  clinic().update('patients', p.id, { link: 'none', doctorId: null, updatedAt: isoNow() })
  closeLinkAlerts(p.id)
  toast('اترفض الطلب')
}

/* ---------- before the diagnosis ---------- */

export function sendOrders(p: Patient, tests: OrderId[]): boolean {
  if (!tests.length) {
    toast('اختاري فحص واحد على الأقل')
    return false
  }
  const at = isoNow()
  clinic().update('patients', p.id, { orders: { tests, at, by: doctorName() }, updatedAt: at })
  say(p.id, 'طلبت لك: ' + tests.map((id) => ORDER_LABEL[id]).join('، ') + '. اعملي الفحوصات دي وارفعيها في تاب «الفحوصات»، وهتوصلني على طول.')
  toast('الطلب وصل للمريضة')
  return true
}

export type DxForm = {
  result: Diagnosis['result']
  stage: string
  er: boolean
  pr: boolean
  her2: boolean
  grade: string
  plan: string // a key of PLAN_LABELS
}

export function confirmDx(p: Patient, f: DxForm) {
  const at = isoNow()
  const by = doctorName()
  const malignant = f.result === 'malignant'
  const diagnosis: Diagnosis = malignant
    ? { result: 'malignant', stage: f.stage, er: f.er, pr: f.pr, her2: f.her2, grade: f.grade, confirmedAt: at, by }
    : { result: f.result, confirmedAt: at, by }
  const patch: Partial<Patient> = { diagnosis, updatedAt: at }
  if (malignant) {
    const steps = buildPlan(f.plan, f.er || f.pr)
    patch.plan = { template: f.plan, steps }
    patch.appts = [{ id: 'a' + Date.now(), title: steps[0].title, date: steps[0].date, time: '10:00' }]
  }
  clinic().update('patients', p.id, patch)
  say(
    p.id,
    malignant
      ? 'راجعت تقرير العيّنة وأكدت التشخيص، وحطّيت لك خطة العلاج في «متابعتي». أنا معاكِ خطوة بخطوة، وأي سؤال ابعتيه هنا.'
      : 'راجعت نتايجك، والحمد لله ' + (f.result === 'benign' ? 'الورم حميد.' : 'كل حاجة سليمة.') + ' كمّلي الفحص الذاتي كل شهر، وهنتابع بشكل دوري.',
  )
  toast('اتأكد التشخيص')
}

/* ---------- the treatment plan ---------- */

export function advance(p: Patient) {
  const steps = planInfo(p).steps.map((s) => ({ ...s }))
  const i = steps.findIndex((s) => s.status === 'current')
  if (i < 0 || !p.plan) return
  steps[i].status = 'done'
  if (steps[i + 1]) steps[i + 1].status = 'current'
  clinic().update('patients', p.id, { plan: { ...p.plan, steps }, updatedAt: isoNow() })
  toast('اتحدّثت الخطة')
}

export function addAppt(p: Patient, a: { title: string; date: string; time: string }): boolean {
  if (!a.title.trim() || !a.date) {
    toast('اكتبي اسم الميعاد واليوم')
    return false
  }
  const appts = [...(p.appts || []), { id: 'a' + Date.now(), title: a.title.trim(), date: a.date, time: a.time || '10:00' }]
  clinic().update('patients', p.id, { appts, updatedAt: isoNow() })
  toast('اتضاف الميعاد')
  return true
}

export function delAppt(p: Patient, id: string) {
  clinic().update('patients', p.id, { appts: (p.appts || []).filter((a) => a.id !== id), updatedAt: isoNow() })
  toast('اتشال الميعاد')
}

// "8, 20:30" → ["08:00", "20:30"]
export function parseTimes(text: string): string[] {
  return normalize(text)
    .split(/[,،\s]+/)
    .filter(Boolean)
    .map((x) => {
      const [hh, mm] = x.split(':')
      const h = Math.min(23, Math.max(0, parseInt(hh, 10) || 0))
      const m = Math.min(59, Math.max(0, parseInt(mm, 10) || 0))
      return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m
    })
}

export function addMed(p: Patient, m: { name: string; dose: string; times: string; note: string }): boolean {
  const times = parseTimes(m.times)
  if (!m.name.trim() || !times.length) {
    toast('اكتبي اسم الدوا ومواعيده')
    return false
  }
  const med = { id: 'm' + Date.now(), name: m.name.trim(), dose: m.dose.trim() || 'حسب الوصفة', times, note: m.note.trim(), since: isoNow() }
  clinic().update('patients', p.id, { meds: [...(p.meds || []), med], updatedAt: isoNow() })
  toast('اتضاف الدوا')
  return true
}

export function delMed(p: Patient, id: string) {
  clinic().update('patients', p.id, { meds: (p.meds || []).filter((m) => m.id !== id), updatedAt: isoNow() })
  toast('اتشال الدوا')
}

/* ---------- notes, messages, alerts ---------- */

export function addNote(p: Patient, text: string): boolean {
  const t = text.trim()
  if (!t) return false
  clinic().add('notes', { pid: p.id, text: t.slice(0, 1500), at: isoNow(), by: doctorName() })
  toast('اتحفظت الملاحظة')
  return true
}

export function sendMessage(p: Patient, text: string): boolean {
  const t = text.trim()
  if (!t) return false
  say(p.id, t)
  return true
}

export function closeAlert(a: Alert) {
  clinic().update('alerts', a.id, { status: 'done', closedAt: isoNow() })
}

// The doctor's messages count as read once her file is open.
export function markReadByDoctor(pid: string) {
  const unread = listOf<'messages'>(clinic().messages).filter((m) => m.pid === pid && m.from === 'patient' && !m.readD)
  if (unread.length) clinic().updateMany('messages', unread.map((m) => m.id), { readD: true })
}

// The patient sees when her file was last opened (once per patient each time the dashboard opens).
const opened = new Set<string>()
export function logOpen(pid: string) {
  if (opened.has(pid)) return
  opened.add(pid)
  clinic().add('access', { pid, at: isoNow(), who: doctorName() || 'الطبيب' })
}

/* ---------- the doctor's account ---------- */

export function savePhone(phone: string) {
  const id = getCurrentDoctorId()
  clinic().update('doctors', id, { phone: phone.trim() })
  toast('اتحفظ الرقم')
}

// "ابدئي العرض من الأول": removes the patients who linked during the demo; the practice ones stay.
export function resetDemo() {
  const live = Object.values(clinic().patients).filter((p) => !p.demo)
  resetLive()
  for (const p of live) deleteFilesOf(p.id).catch(() => undefined)
  opened.clear()
  toast('اتمسحت المريضة اللي اتربطت في العرض')
}
