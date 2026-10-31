// Uploading her tests: the details go to her app (store/tests.ts) and the file itself to the file store
// (lib/files.ts), where the doctor's dashboard opens it. With Supabase, the file store becomes Supabase Storage.
import type { Patient } from '../data/clinic'
import { TEST_SLOTS, type TestId } from '../data/tests'
import { analyzeScans, clinicFetch, readLabs } from '../lib/api'
import { practiceFile } from '../lib/demoScans'
import { deleteFile, fileKey, getFile, saveFile } from '../lib/files'
import { makeThumbnail } from '../lib/image'
import { useAssessment } from './assessment'
import { useAuth } from './auth'
import { mergeRows, useClinic } from './clinic'
import { getMyRecord, markRestored, myId, noteUpload, syncMyRecord } from './doctor'
import { hasScan, useTests, type Upload } from './tests'

const titleOf = (id: TestId) => TEST_SLOTS.find((t) => t.id === id)?.title ?? 'الفحص'

// What to tell her when a call to the server fails.
const reason = (e: unknown, what: string) =>
  e instanceof TypeError ? 'مش قادرين نوصل للسيرفر. اتأكدي إنه شغال وجرّبي تاني.' : e instanceof Error ? e.message : `حصل خطأ في قراءة ${what}`

// Keeps the file for the doctor. Returns false when this browser can't keep it (then only the details are saved).
async function keep(id: TestId, blob: Blob, name: string, type: string, at: string) {
  const pid = myId()
  if (!pid) return false
  try {
    await saveFile({ key: fileKey(pid, id), pid, test: id, name, type, size: blob.size, at, blob })
    return true
  } catch {
    return false
  }
}

export async function uploadFile(id: TestId, file: File) {
  const at = new Date().toISOString()
  const thumb = await makeThumbnail(file)
  await keep(id, file, file.name, file.type, at)
  useTests.getState().add(id, { name: file.name, size: file.size, type: file.type, thumb, demo: false, at })
  noteUpload(`استلمنا ملف «${titleOf(id)}»`)
}

export async function removeUpload(id: TestId) {
  useTests.getState().remove(id)
  const pid = myId()
  if (pid) await deleteFile(fileKey(pid, id)).catch(() => undefined)
}

// "جرّبي بملفات تجريبية": practice pictures in the empty boxes (her own files stay).
export async function addPracticeFiles() {
  const pid = myId() || 'p_guest'
  const empty = TEST_SLOTS.filter((t) => !useTests.getState().uploads[t.id])
  const at = new Date().toISOString()
  const demo: Partial<Record<TestId, Upload>> = {}
  for (const t of empty) {
    const f = await practiceFile(t.id, pid)
    await keep(t.id, f.blob, f.name, f.type, at)
    demo[t.id] = { name: f.name, size: f.blob.size, type: f.type, thumb: await makeThumbnail(f.blob), demo: true, at }
  }
  useTests.getState().addDemo(demo)
  noteUpload('استلمنا الملفات التجريبية')
}

// After she signs in again with her email: her uploads come back from her file at the clinic,
// with their previews made again from the kept files.
export async function restoreUploads() {
  const t = useTests.getState()
  const p = getMyRecord()
  const pid = myId()
  if (!p || !pid || Object.keys(t.uploads).length || !p.files || !p.files.length) return
  const uploads: Partial<Record<TestId, Upload>> = {}
  for (const f of p.files) uploads[f.test] = { name: f.name, size: f.size, type: f.type, thumb: null, demo: f.demo, at: f.at }
  t.restore(uploads, !!p.prediction?.reading, p.prediction?.reading ?? null)
  for (const f of p.files) {
    const kept = await getFile(fileKey(pid, f.test), { remote: false }).catch(() => null)
    const thumb = kept ? await makeThumbnail(kept.blob) : null
    if (thumb) useTests.getState().setThumb(f.test, thumb)
  }
}

// Her name, age and answers from her file at the clinic. "overwrite": the clinic's copy wins (it was just read from
// the server); otherwise only what this app doesn't have yet is filled in.
export function fillFromRecord(p: Patient, overwrite: boolean) {
  const a = useAssessment.getState()
  const fill: Partial<{ name: string; age: string; answers: Record<string, number>; chronic: string[]; done: boolean }> = {}
  if (p.name && p.name !== 'مريضة جديدة' && (overwrite || !a.name.trim())) fill.name = p.name
  if (p.age && (overwrite || !a.age)) fill.age = String(p.age)
  const saved = p.assessment
  if (saved?.answers && Object.keys(saved.answers).length && (overwrite || !a.done)) {
    fill.answers = saved.answers
    fill.chronic = saved.chronicIds ?? a.chronic
    fill.done = true
  }
  if (Object.keys(fill).length) useAssessment.setState(fill)
}

const HER_TABLES = ['messages', 'symptoms', 'labs', 'notes', 'alerts', 'medlogs', 'access'] as const

// When she signs in, and every time her app opens: her file comes back from the clinic, the same on every phone.
// Answers false when the server couldn't be reached (PatientShell tries again a few seconds later).
export async function restoreMyFile(): Promise<boolean> {
  const email = (useAuth.getState().user?.email || '').toLowerCase().trim()
  const pid = myId()
  if (!pid || !email) return false
  let res: Response
  try {
    res = await clinicFetch(`/api/clinic/patients/by-email/${encodeURIComponent(email)}`)
  } catch {
    return false
  }
  if (myId() !== pid) return false // she signed out meanwhile
  let fromServer = false
  if (res.ok) {
    const data = await res.json().catch(() => null)
    if (data?.patient) {
      mergeRows('patients', [data.patient])
      for (const t of HER_TABLES) mergeRows(t, data[t])
      fromServer = true
    }
  } else if (res.status === 404) {
    // The clinic doesn't have her file. If this browser has it (made while the server was off), it goes there now.
    const kept = getMyRecord()
    if (kept) useClinic.getState().put('patients', kept)
  } else {
    return false
  }
  const p = getMyRecord()
  if (p) fillFromRecord(p, fromServer)
  // Files she uploaded from another phone show here too (their details; the files themselves are with the doctor)
  const t = useTests.getState()
  if (fromServer && p?.files?.length && Object.keys(t.uploads).length) {
    const missing = p.files.filter((f) => !t.uploads[f.test])
    if (missing.length) {
      const uploads = { ...t.uploads }
      for (const f of missing) uploads[f.test] = { name: f.name, size: f.size, type: f.type, thumb: null, demo: f.demo, at: f.at }
      useTests.setState({ uploads })
    }
    if (!t.reading && p.prediction?.reading) useTests.setState({ reading: p.prediction.reading, analyzed: true })
  }
  await restoreUploads()
  markRestored(pid)
  syncMyRecord() // anything she did on this phone before, now that her file is here
  return true
}

// What "حلّلي النتائج" ends with: an error to show her about the scans, and, when her lab report couldn't be read, a
// calm note for the labs card (the paper itself is kept in her file for her doctor; she only tries again later).
export type AnalysisOutcome = { error: string | null; labsNote: string | null }

// "حلّلي النتائج": her mammogram and ultrasound go to the real scan model on the server, and her lab report to the
// labs reader.
export async function runAnalysis(): Promise<AnalysisOutcome> {
  const pid = myId()
  const t = useTests.getState()
  if (!pid) return { error: 'سجّلي دخولك الأول', labsNote: null }
  if (!hasScan(t.uploads) && !t.uploads.lab) return { error: 'ارفعي ماموجرام أو سونار أو تحليل دم الأول', labsNote: null }
  const errors: string[] = []

  // 1) The scans
  const files = { mammogram: [] as Blob[], ultrasound: [] as Blob[] }
  for (const [id, key] of [
    ['mammo', 'mammogram'],
    ['us', 'ultrasound'],
  ] as const) {
    if (!t.uploads[id]) continue
    const kept = await getFile(fileKey(pid, id)).catch(() => null)
    if (kept) files[key].push(kept.blob)
    else errors.push(`ملف «${titleOf(id)}» مش محفوظ على الجهاز ده. ارفعيه تاني.`)
  }
  if (files.mammogram.length || files.ultrasound.length) {
    try {
      const result = await analyzeScans(files)
      const demo = !!(t.uploads.mammo?.demo || t.uploads.us?.demo)
      useTests.getState().setReading({ ...result, at: new Date().toISOString(), demo })
      syncMyRecord() // so her doctor sees the reading too
    } catch (e) {
      errors.push(reason(e, 'الأشعة'))
    }
  }

  // 2) The lab report
  const labsNote = t.uploads.lab ? await readLabReport() : null
  return { error: errors.length ? errors.join(' · ') : null, labsNote }
}

// Her lab report goes to the labs reader on the server. Returns null when it was read, or what to tell her
// (also used by "جرّبي تاني").
export async function readLabReport(): Promise<string | null> {
  const pid = myId()
  const lab = useTests.getState().uploads.lab
  if (!pid || !lab) return null
  const kept = await getFile(fileKey(pid, 'lab')).catch(() => null)
  if (!kept) return `ملف «${titleOf('lab')}» مش محفوظ على الجهاز ده. ارفعيه تاني.`
  try {
    const result = await readLabs(kept.blob, kept.name)
    useTests.getState().setLabs({ ...result, at: new Date().toISOString(), demo: !!lab.demo })
    return null
  } catch (e) {
    return reason(e, 'التحاليل')
  }
}
