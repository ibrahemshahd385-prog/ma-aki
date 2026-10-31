import { supabase } from './supabase'

// The backend's address. When it runs on this computer, the app asks its own address and Vite passes the request
// on (vite.config.ts), so it works on the computer and from a phone through the public link alike. A backend on
// another server is set in VITE_API_URL.
const configured = import.meta.env.VITE_API_URL || ''
const API_URL = /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(configured) ? '' : configured

async function token() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token || ''
}

// An answer from the server that isn't a success, with its status (401: she has to sign in again).
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// The server's own message when it has one (it writes them in Arabic for her), or a general one.
async function failure(response: Response, fallback: string) {
  let message = fallback
  try {
    const body = await response.json()
    if (typeof body?.detail === 'string') message = body.detail
  } catch {
    // not JSON
  }
  return new ApiError(message, response.status)
}

// The shared clinic data on our server (backend/app/routers/clinic.py). Every request carries her sign-in, and
// the server answers only with what this account may see.
export async function clinicFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  const t = await token()
  if (t) headers.set('Authorization', `Bearer ${t}`)
  return fetch(`${API_URL}${path}`, { ...init, headers })
}

// ونس (Claude) from the server
export async function askWanesAI(prompt: string) {
  const response = await fetch(`${API_URL}/api/ai/wanes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
    body: JSON.stringify({ prompt }),
  })
  if (!response.ok) throw await failure(response, 'فشل الاتصال بخدمة الذكاء الاصطناعي')
  return (await response.json()) as { reply: string }
}

// What the scan model on the server returns (backend/app/ml/bcmid.py).
export type ScanResult = {
  probability: number // the chance a radiologist would rate the case BI-RADS 4-6
  level: 'high' | 'low'
  threshold: number
  by_modality: { mammogram?: number; ultrasound?: number }
  images: { mammogram: number; ultrasound: number }
  model: {
    name: string
    used: string
    predicts: string
    auc: number
    auc_sd: number
    sensitivity: number
    specificity: number
    auc_same_groups: number
    cases: number
    data: string
    trained_on: string
  }
  not_a_diagnosis: string
}

// Reads the scans with the real model on the server. The pictures are read there and not kept.
export async function analyzeScans(files: { mammogram: Blob[]; ultrasound: Blob[] }) {
  const form = new FormData()
  files.mammogram.forEach((b, i) => form.append('mammogram', b, `mammogram_${i + 1}`))
  files.ultrasound.forEach((b, i) => form.append('ultrasound', b, `ultrasound_${i + 1}`))
  const response = await fetch(`${API_URL}/api/radiology/analyze`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await token()}` },
    body: form,
  })
  if (!response.ok) throw await failure(response, 'فشل تحليل صور الأشعة')
  return (await response.json()) as ScanResult
}

// What the labs reader on the server returns (backend/app/labs.py).
export type LabValue = {
  test: 'hemoglobin' | 'wbc' | 'anc' | 'platelets' | 'ca15_3'
  name: string
  unit: string
  value: number
  low: number | null
  high: number | null
  range_from: 'report' | 'default'
  as_written: string
  status: 'low' | 'normal' | 'high'
  severity: 'ok' | 'yellow' | 'red'
  note: string
  source: string
}

export type LabResult = {
  is_lab_report: boolean
  report_date: string | null
  values: LabValue[]
  severity: 'ok' | 'yellow' | 'red'
  sources: Record<string, string>
  disclaimer: string
}

// Claude reads the blood test values from her report on the server, and fixed rules compare them with the
// normal ranges (the report's own ranges when it prints them). The file is not kept there.
export async function readLabs(file: Blob, name: string) {
  const form = new FormData()
  form.append('file', file, name)
  const response = await fetch(`${API_URL}/api/labs/read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await token()}` },
    body: form,
  })
  if (!response.ok) throw await failure(response, 'فشل قراءة التحاليل')
  return (await response.json()) as LabResult
}
