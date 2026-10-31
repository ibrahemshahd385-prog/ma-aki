// Her file at the clinic: the link with her doctor, and what she shares with the doctor (messages, symptoms,
// lab results, the medicine doses she took). It lives in the shared data (store/clinic.ts), so the doctor's
// dashboard sees every change, and her app sees the doctor's.
import { useMemo } from 'react'
import { clinicFetch } from '../lib/api'
import { CHRONIC, LEVELS, scoreAssessment } from '../data/assessment'
import {
  LAB_DEFS,
  labFlag,
  modeOf,
  symptomFlags,
  UPLOAD_NAME,
  urgentByWords,
  type Doctor,
  type Flag,
  type LabTest,
  type Mode,
  type Patient,
  type SharedFile,
} from '../data/clinic'
import type { Tables } from '../data/seed'
import { TEST_SLOTS, type TestId } from '../data/tests'
import { normalize } from '../lib/arabic'
import { byTime, hoursText, isOfficeHours, isoNow, tOf, ymd } from '../lib/dates'
import { useAssessment } from './assessment'
import { patientIdOf, useAuth } from './auth'
import { listOf, loadSavedDoctors, saveDoctorLocally, useClinic, type Row } from './clinic'
import { useNotifications } from './notifications'
import { hasScan, useTests, type ScanReading, type Upload } from './tests'

// The scan reading the doctor sees: the real model's answer in two short lines.
export function readingToPrediction(r: ScanReading) {
  const used = [r.images.mammogram ? 'ماموجرام' : '', r.images.ultrasound ? 'سونار' : ''].filter(Boolean).join(' + ')
  return {
    birads: `احتمال BI-RADS 4–6: ${Math.round(r.probability * 100)}%`,
    label: (r.level === 'high' ? 'أعلى من حد النموذج، محتاج مراجعة' : 'أقل من حد النموذج') + ' · ' + used,
    demo: r.demo,
    reading: r,
  }
}

/* ---------- who she is, and where she is ---------- */

export const myId = () => patientIdOf(useAuth.getState().user)
export const useMyId = () => useAuth((s) => patientIdOf(s.user))

export function getMyRecord(): Patient | null {
  const id = myId()
  return id ? (useClinic.getState().patients[id] ?? null) : null
}
export function useMyRecord(): Patient | null {
  const id = useMyId()
  return useClinic((s) => (id ? (s.patients[id] ?? null) : null))
}

export const getMode = (): Mode => modeOf(getMyRecord())
export const useMode = (): Mode => modeOf(useMyRecord())

// The doctor accepted her: the doctor sees her file and they can write to each other.
export const isLinked = (m: Mode) => m === 'linked' || m === 'follow' || m === 'routine'

function doctorOf(p: Patient | null, doctors: Record<string, Doctor>) {
  return p && p.link !== 'none' && p.doctorId ? (doctors[p.doctorId] ?? null) : null
}
// Her doctor, while a request is waiting and after it is accepted.
export const getMyDoctor = () => doctorOf(getMyRecord(), useClinic.getState().doctors)
export function useMyDoctor() {
  const p = useMyRecord()
  const doctors = useClinic((s) => s.doctors)
  return doctorOf(p, doctors)
}

// Finds a doctor by the code from the clinic. "mk4821", "MK 4821", "MK-٤٨٢١" and "MK-4539" all work.
export function findDoctor(code: string): Doctor | null {
  const clean = (c: string) => normalize(c).toUpperCase().replace(/[^A-Z0-9]/g, '')
  const want = clean(code)
  if (!want) return null

  // 1. فحص الأطباء في الذاكرة
  const stateDocs = useClinic.getState().doctors
  let match = Object.values(stateDocs).find((d) => clean(d.code) === want) ?? null
  if (match) return match

  // 2. فحص الأطباء المحفوظين محلياً من أي نافذة أخرى
  try {
    const saved = loadSavedDoctors()
    match = Object.values(saved).find((d) => clean(d.code) === want) ?? null
    if (match) {
      useClinic.setState((s) => ({ doctors: { ...s.doctors, [match!.id]: match! } }))
      return match
    }
  } catch {}

  // 3. جلب الطبيب في الخلفية من السيرفر المركزي لو الكود جديد
  if (typeof window !== 'undefined' && want.length >= 4) {
    clinicFetch(`/api/clinic/doctors/${encodeURIComponent(want)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((doc) => {
        if (doc?.id) {
          useClinic.setState((s) => ({ doctors: { ...s.doctors, [doc.id]: doc } }))
          saveDoctorLocally(doc)
        }
      })
      .catch(() => {})
  }

  return null
}

// Finds a doctor asynchronously, querying the central server API if not yet cached.
export async function findDoctorAsync(code: string): Promise<Doctor | null> {
  const sync = findDoctor(code)
  if (sync) return sync

  const clean = (c: string) => normalize(c).toUpperCase().replace(/[^A-Z0-9]/g, '')
  const want = clean(code)
  if (!want) return null

  try {
    const res = await clinicFetch(`/api/clinic/doctors/${encodeURIComponent(want)}`)
    if (res.ok) {
      const doc = await res.json()
      if (doc && doc.id) {
        useClinic.setState((s) => ({ doctors: { ...s.doctors, [doc.id]: doc } }))
        saveDoctorLocally(doc)
        return doc
      }
    }
  } catch {}

  return null
}

/* ---------- her rows in the shared tables, oldest first ---------- */

type Mine = 'messages' | 'symptoms' | 'labs' | 'notes' | 'access' | 'alerts' | 'medlogs'

function own<T extends Mine>(rows: Tables[T], id: string | null): Row<T>[] {
  if (!id) return []
  return listOf<T>(rows)
    .filter((r) => r.pid === id)
    .sort(byTime)
}

export function useMine<T extends Mine>(table: T): Row<T>[] {
  const id = useMyId()
  const rows = useClinic((s) => s[table])
  return useMemo(() => own<T>(rows, id), [rows, id])
}
export const getMine = <T extends Mine>(table: T): Row<T>[] => own<T>(useClinic.getState()[table], myId())

// Messages from her doctor (and the app's notes) that she hasn't opened yet.
export function useUnread() {
  const messages = useMine('messages')
  return messages.filter((m) => m.from !== 'patient' && !m.readP).length
}

/* ---------- what she shares with the doctor ---------- */

// The files she uploaded, as her file at the clinic lists them (the files themselves are in lib/files.ts).
export function sharedFiles(uploads: Partial<Record<TestId, Upload>>): SharedFile[] {
  return TEST_SLOTS.flatMap((s) => {
    const u = uploads[s.id]
    return u ? [{ test: s.id, name: u.name, type: u.type || '', size: u.size, at: u.at, demo: u.demo }] : []
  })
}

// The parts of her app the doctor sees: name, age, the assessment, the tests she uploaded and their reading.
function shared() {
  const a = useAssessment.getState()
  const t = useTests.getState()
  const r = scoreAssessment(a.age, a.chronic, a.answers)
  return {
    name: a.name.trim(),
    age: parseInt(a.age, 10) || null,
    chronic: CHRONIC.filter((c) => c.id !== 'none' && a.chronic.includes(c.id)).map((c) => c.label),
    assessment:
      a.done && Object.keys(a.answers).length
        ? { label: LEVELS[r.level].label, level: r.level, factors: r.factors, answers: a.answers, chronicIds: a.chronic }
        : null,
    uploads: TEST_SLOTS.filter((s) => t.uploads[s.id]).map((s) => UPLOAD_NAME[s.id]),
    files: sharedFiles(t.uploads),
    prediction: t.reading && hasScan(t.uploads) ? readingToPrediction(t.reading) : null,
  }
}

// Sends a link request. The doctor sees it in the dashboard and accepts or declines it.
export function requestLink(doctor: Doctor) {
  const id = myId()
  if (!id) return
  const s = shared()
  const before = getMyRecord() // what her file already has, kept when this phone doesn't have it
  const at = isoNow()
  const clinic = useClinic.getState()
  clinic.put('patients', {
    id,
    name: s.name || before?.name || 'مريضة جديدة',
    age: s.age ?? before?.age ?? null,
    chronic: s.assessment ? s.chronic : (before?.chronic ?? s.chronic),
    assessment: s.assessment ?? before?.assessment ?? null,
    prediction: s.prediction ?? before?.prediction ?? null,
    uploads: s.uploads,
    files: s.files,
    link: 'pending',
    doctorId: doctor.id,
    requestedAt: at,
    meds: [],
    appts: [],
    updatedAt: at,
  })
  clinic.add('alerts', { pid: id, severity: 'yellow', kind: 'link', text: 'طلب ربط جديد', status: 'open', at })
}

// Cancels a waiting request, or unlinks her account from her doctor.
export function cancelLink() {
  const id = myId()
  if (!id) return
  const clinic = useClinic.getState()
  clinic.update('patients', id, { link: 'none', doctorId: null, updatedAt: isoNow() })
  const open = getMine('alerts').filter((a) => a.kind === 'link' && a.status === 'open')
  clinic.updateMany('alerts', open.map((a) => a.id), { status: 'done' })
}

// Her file is sent to the clinic only after this app read it back from the clinic (store/uploads.ts,
// restoreMyFile). Otherwise a phone she never used, or a browser another woman used before her, would send her file
// empty answers, and the next time she signs in she would look like a new person.
let restoredFor: string | null = null
export function markRestored(pid: string | null) {
  restoredFor = pid // null when someone signs in: her file has to be read back again first
}

// Keeps her file up to date when she changes something the doctor sees (the assessment, an upload...).
export function syncMyRecord() {
  const user = useAuth.getState().user
  const id = myId()
  if (!id || !user || user.guest) return
  if (restoredFor !== id) return
  const p = getMyRecord()
  const s = shared()

  if (!p) {
    // إذا كانت المريضة مسجلة بحساب وبدأت التقييم أو كتابة الاسم، نحفظ بياناتها لتظل في السيرفر دائماً
    if (s.name || s.age || s.assessment) {
      const at = isoNow()
      useClinic.getState().put('patients', {
        id,
        name: s.name || 'مريضة جديدة',
        age: s.age,
        chronic: s.chronic,
        assessment: s.assessment,
        prediction: s.prediction,
        uploads: s.uploads,
        files: s.files,
        link: 'none',
        doctorId: null,
        requestedAt: undefined,
        meds: [],
        appts: [],
        updatedAt: at,
      })
    }
    return
  }

  const patch: Partial<Patient> = { uploads: s.uploads, files: s.files }
  if (s.name) patch.name = s.name
  if (s.age) patch.age = s.age
  if (s.assessment) {
    patch.assessment = s.assessment
    patch.chronic = s.chronic
  }
  if (s.prediction) patch.prediction = s.prediction
  const keys = Object.keys(patch) as (keyof Patient)[]
  const same = keys.every((k) => JSON.stringify(p[k] ?? null) === JSON.stringify(patch[k] ?? null))
  if (!same) useClinic.getState().update('patients', p.id, { ...patch, updatedAt: isoNow() })
}

/* ---------- follow-up: what she sends ---------- */

// A message to her doctor. Urgent words (fever, bleeding...) also raise a red alert for the doctor.
export function sendToDoctor(text: string): boolean {
  const p = getMyRecord()
  const t = text.trim()
  if (!p || !t || !isLinked(modeOf(p))) return false
  const d = getMyDoctor()
  const urgent = urgentByWords(t)
  const clinic = useClinic.getState()
  clinic.add('messages', { pid: p.id, from: 'patient', text: t.slice(0, 1000), at: isoNow(), urgent, readD: false, readP: true })
  if (urgent) clinic.add('alerts', { pid: p.id, severity: 'red', kind: 'message', text: 'رسالة عاجلة', status: 'open', at: isoNow() })
  // Outside the doctor's hours, the app says when she answers (once an hour, not after every message).
  const lastNote = getMine('messages').filter((m) => m.from === 'system').pop()
  const noteIsRecent = lastNote && tOf(lastNote) > Date.now() - 3600000
  if (d && !isOfficeHours(d.hours) && !noteIsRecent) {
    clinic.add('messages', {
      pid: p.id,
      from: 'system',
      text: 'الرد على الرسائل ' + hoursText(d.hours) + '. لو الأمر طارئ اتصلي 123 أو روحي أقرب طوارئ.',
      at: new Date(Date.now() + 1).toISOString(),
      readP: false,
      readD: true,
    })
  }
  return true
}

export type SymptomEntry = { fatigue: number; nausea: number; pain: number; temp: string; mood: number; note: string }

const toNumber = (text: string) => parseFloat(normalize(text).replace(/[٫,]/g, '.'))

// Today's symptoms. Fever, strong pain and the like also raise an alert for the doctor.
export function saveSymptoms(input: SymptomEntry, source: 'form' | 'wanas' = 'form'): { saved: boolean; flags: Flag[] } {
  const level = (x: number, max: number) => Math.max(0, Math.min(max, Math.round(Number(x) || 0)))
  const temp = toNumber(input.temp)
  const entry = {
    fatigue: level(input.fatigue, 3),
    nausea: level(input.nausea, 3),
    pain: level(input.pain, 10),
    temp: temp >= 34 && temp <= 43 ? Math.round(temp * 10) / 10 : null,
    mood: level(input.mood, 3),
    note: input.note.trim().slice(0, 300),
    source,
  }
  const flags = symptomFlags(entry)
  const p = getMyRecord()
  if (!p || !isLinked(modeOf(p))) return { saved: false, flags }
  const at = isoNow()
  const clinic = useClinic.getState()
  clinic.add('symptoms', { pid: p.id, at, ...entry })
  for (const f of flags) clinic.add('alerts', { pid: p.id, severity: f.severity, kind: f.kind, text: f.text, status: 'open', at })
  return { saved: true, flags }
}

// Marks a dose as taken today, or un-marks it.
export function takeDose(medId: string, time: string) {
  const id = myId()
  if (!id) return
  const day = ymd(new Date())
  const done = getMine('medlogs').find((l) => l.medId === medId && l.day === day && l.time === time)
  if (done) useClinic.getState().remove('medlogs', done.id)
  else useClinic.getState().add('medlogs', { pid: id, medId, day, time, at: isoNow() })
}

// A lab result she typed. Returns false when the value isn't a number.
export function addLab(test: LabTest, valueText: string): boolean {
  const p = getMyRecord()
  const value = toNumber(valueText)
  if (!p || !isLinked(modeOf(p)) || !(value >= 0)) return false
  const def = LAB_DEFS[test]
  const lab = { pid: p.id, test, value, unit: def.unit, ref: def.ref ?? null, low: def.low ?? null, at: isoNow(), source: 'manual' }
  const clinic = useClinic.getState()
  clinic.add('labs', lab)
  const flag = labFlag(lab)
  if (flag) clinic.add('alerts', { pid: p.id, severity: 'yellow', kind: 'lab', text: flag, status: 'open', at: lab.at })
  return true
}

// Opening the messages counts as reading them.
export function markMessagesRead() {
  const unread = getMine('messages').filter((m) => m.from !== 'patient' && !m.readP)
  if (unread.length) useClinic.getState().updateMany('messages', unread.map((m) => m.id), { readP: true })
}

// The note under the bell after an upload: where the file goes.
export function noteUpload(title: string) {
  const mode = getMode()
  const d = getMyDoctor()
  const text =
    mode === 'pre' || !d
      ? 'الدكتور هيلاقيه في ملفك بعد ما تربطي حسابك.'
      : mode === 'pending'
        ? `هيوصل عند ${d.name} أول ما طلب الربط يتقبل.`
        : `هيظهر في ملفك عند ${d.name}.`
  useNotifications.getState().add(title, text)
}
