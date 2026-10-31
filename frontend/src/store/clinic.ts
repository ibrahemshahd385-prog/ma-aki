import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { SEED, type Tables } from '../data/seed'
import { dbToRow, rowToDb } from '../lib/db'
import { supabase } from '../lib/supabase'
import { clinicFetch } from '../lib/api'
import { doctorIdOf, patientIdOf, useAuth } from './auth'

export type Table = keyof Tables
export type Row<T extends Table> = Tables[T][string]

type ClinicState = Tables & {
  add: <T extends Table>(table: T, row: Omit<Row<T>, 'id'>) => string
  update: <T extends Table>(table: T, id: string, patch: Partial<Row<T>>) => void
  updateMany: <T extends Table>(table: T, ids: string[], patch: Partial<Row<T>>) => void
  put: <T extends Table>(table: T, row: Row<T>) => void
  remove: (table: Table, id: string) => void
  forget: (drop: (patientId: string) => boolean) => void
}

export const TABLES: Table[] = ['doctors', 'patients', 'messages', 'symptoms', 'labs', 'notes', 'access', 'alerts', 'medlogs']

const newId = (table: Table) => table.slice(0, 2) + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export const CLINIC_STORAGE_KEY = 'maaki_clinic_tables_v1'
export const DOCTORS_STORAGE_KEY = 'maaki_registered_doctors_v1'
const BROADCAST_CHANNEL_NAME = 'maaki_clinic_sync'

// 1. التخزين المؤقت المحلي للأطباء المسجلين
export function loadSavedDoctors(): Record<string, Row<'doctors'>> {
  const result: Record<string, Row<'doctors'>> = {}
  try {
    const raw = localStorage.getItem(DOCTORS_STORAGE_KEY)
    if (raw) Object.assign(result, JSON.parse(raw))
  } catch {}

  try {
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('maaki_doctor_email_')) {
          try {
            const doc = JSON.parse(localStorage.getItem(k) || '')
            if (doc?.id) result[doc.id] = doc
          } catch {}
        }
      }
    }
  } catch {}

  return result
}

export function saveDoctorLocally(doc: Row<'doctors'>) {
  try {
    const existing = loadSavedDoctors()
    existing[doc.id] = doc
    localStorage.setItem(DOCTORS_STORAGE_KEY, JSON.stringify(existing))
    if (doc.email) {
      localStorage.setItem('maaki_doctor_email_' + doc.email.toLowerCase().trim(), JSON.stringify(doc))
    }
  } catch {}
}

export const emptyTables = (): Tables => ({
  doctors: {},
  patients: {},
  messages: {},
  symptoms: {},
  labs: {},
  notes: {},
  access: {},
  alerts: {},
  medlogs: {},
})

export function loadLocalTables(): Tables {
  try {
    const raw = localStorage.getItem(CLINIC_STORAGE_KEY)
    const savedDocs = loadSavedDoctors()
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Tables>
      return {
        doctors: { ...SEED.doctors, ...(parsed.doctors || {}), ...savedDocs },
        patients: parsed.patients || {},
        messages: parsed.messages || {},
        symptoms: parsed.symptoms || {},
        labs: parsed.labs || {},
        notes: parsed.notes || {},
        access: parsed.access || {},
        alerts: parsed.alerts || {},
        medlogs: parsed.medlogs || {},
      }
    }
    return {
      ...emptyTables(),
      doctors: { ...SEED.doctors, ...savedDocs },
    }
  } catch {}
  return {
    ...emptyTables(),
    doctors: { ...SEED.doctors },
  }
}

export function saveLocalTables(state: Tables) {
  try {
    const toSave: Partial<Tables> = {}
    for (const t of TABLES) {
      toSave[t] = state[t] as any
    }
    localStorage.setItem(CLINIC_STORAGE_KEY, JSON.stringify(toSave))
    if (state.doctors) {
      localStorage.setItem(DOCTORS_STORAGE_KEY, JSON.stringify(state.doctors))
    }
  } catch {}
}

// 2. مزامنة فورية عبر نوافذ المتصفح (BroadcastChannel)
let bc: BroadcastChannel | null = null
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
  }
} catch {}

type BroadcastMsg =
  | { type: 'PUT'; table: Table; row: unknown }
  | { type: 'ADD'; table: Table; row: unknown }
  | { type: 'UPDATE'; table: Table; id: string; patch: unknown }
  | { type: 'UPDATE_MANY'; table: Table; ids: string[]; patch: unknown }
  | { type: 'REMOVE'; table: Table; id: string }
  | { type: 'SYNC'; tables: Tables }

function postBroadcast(msg: BroadcastMsg) {
  try {
    bc?.postMessage(msg)
  } catch {}
}

function syncToBackend(action: string, table: Table, id?: string, data?: unknown, patch?: unknown) {
  if (typeof window === 'undefined') return
  try {
    clinicFetch('/api/clinic/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, table, id, data, patch }),
    }).catch(() => {})
  } catch {}
}

// Shared store with instant cross-tab sync and local persistence
export const useClinic = create<ClinicState>()((set, get) => ({
  ...loadLocalTables(),
  add: (table, row) => {
    const id = newId(table)
    const fullRow = { ...row, id } as Row<typeof table>
    set((s) => ({ [table]: { ...s[table], [id]: fullRow } }) as unknown as Partial<ClinicState>)
    saveLocalTables(get())
    postBroadcast({ type: 'ADD', table, row: fullRow })
    syncToBackend('add', table, id, fullRow)

    // Sync to Supabase
    const dbPayload = rowToDb(fullRow as Record<string, unknown>)
    supabase
      .from(table)
      .insert(dbPayload)
      .then(({ error }) => {
        if (error) console.warn(`Supabase insert error on ${table}:`, error.message)
      })

    return id
  },
  update: (table, id, patch) => {
    set((s) => {
      const old = s[table][id]
      if (!old) return s
      return { [table]: { ...s[table], [id]: { ...old, ...patch } } } as unknown as Partial<ClinicState>
    })
    saveLocalTables(get())
    postBroadcast({ type: 'UPDATE', table, id, patch })
    syncToBackend('update', table, id, undefined, patch)

    // Sync to Supabase
    const dbPatch = rowToDb(patch as Record<string, unknown>)
    supabase
      .from(table)
      .update(dbPatch)
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.warn(`Supabase update error on ${table}:`, error.message)
      })
  },
  updateMany: (table, ids, patch) => {
    set((s) => {
      const rows = { ...s[table] } as Record<string, object>
      let changed = false
      for (const id of ids) {
        if (!rows[id]) continue
        rows[id] = { ...rows[id], ...patch }
        changed = true
      }
      return changed ? ({ [table]: rows } as unknown as Partial<ClinicState>) : s
    })
    saveLocalTables(get())
    postBroadcast({ type: 'UPDATE_MANY', table, ids, patch })
    for (const id of ids) {
      syncToBackend('update', table, id, undefined, patch)
    }

    // Sync to Supabase
    const dbPatch = rowToDb(patch as Record<string, unknown>)
    supabase
      .from(table)
      .update(dbPatch)
      .in('id', ids)
      .then(({ error }) => {
        if (error) console.warn(`Supabase updateMany error on ${table}:`, error.message)
      })
  },
  put: (table, row) => {
    set((s) => ({ [table]: { ...s[table], [row.id]: row } }) as unknown as Partial<ClinicState>)
    saveLocalTables(get())
    if (table === 'doctors') {
      saveDoctorLocally(row as Row<'doctors'>)
    }
    postBroadcast({ type: 'PUT', table, row })
    syncToBackend('put', table, row.id, row)

    // Sync to Supabase
    const dbRow = rowToDb(row as Record<string, unknown>)
    supabase
      .from(table)
      .upsert(dbRow)
      .then(({ error }) => {
        if (error) console.warn(`Supabase upsert error on ${table}:`, error.message)
      })
  },
  remove: (table, id) => {
    set((s) => {
      if (!s[table][id]) return s
      const next = { ...s[table] }
      delete next[id]
      return { [table]: next } as unknown as Partial<ClinicState>
    })
    saveLocalTables(get())
    postBroadcast({ type: 'REMOVE', table, id })
    syncToBackend('remove', table, id)

    // Sync to Supabase
    supabase
      .from(table)
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.warn(`Supabase delete error on ${table}:`, error.message)
      })
  },
  forget: (drop) =>
    set((s) => {
      const out: Record<string, Record<string, unknown>> = {}
      for (const t of TABLES) {
        if (t === 'doctors') {
          out[t] = s[t] as any
          continue
        }
        const rows = s[t] as Record<string, { id: string; pid?: string }>
        const kept: Record<string, unknown> = {}
        for (const [id, row] of Object.entries(rows)) {
          const pid = t === 'patients' ? row.id : row.pid
          if (!pid || !drop(pid)) kept[id] = row
        }
        out[t] = kept
      }
      saveLocalTables(out as Tables)
      postBroadcast({ type: 'SYNC', tables: out as Tables })
      return out as unknown as Partial<ClinicState>
    }),
}))

// Cross-tab message handling via BroadcastChannel
if (bc) {
  bc.onmessage = (event: MessageEvent<BroadcastMsg>) => {
    const msg = event.data
    if (!msg || !msg.type) return
    remoteChangeCount += 1
    try {
      const s = useClinic.getState()
      if (msg.type === 'PUT' || msg.type === 'ADD') {
        const row = msg.row as { id?: string }
        if (row?.id) {
          useClinic.setState({
            [msg.table]: { ...s[msg.table], [row.id]: row },
          } as unknown as Partial<Tables>)
        }
      } else if (msg.type === 'UPDATE') {
        const old = s[msg.table][msg.id]
        if (old) {
          useClinic.setState({
            [msg.table]: { ...s[msg.table], [msg.id]: { ...old, ...(msg.patch as object) } },
          } as unknown as Partial<Tables>)
        }
      } else if (msg.type === 'UPDATE_MANY') {
        const rows = { ...s[msg.table] } as Record<string, object>
        for (const id of msg.ids) {
          if (rows[id]) rows[id] = { ...rows[id], ...(msg.patch as object) }
        }
        useClinic.setState({ [msg.table]: rows } as unknown as Partial<Tables>)
      } else if (msg.type === 'REMOVE') {
        if (s[msg.table][msg.id]) {
          const next = { ...s[msg.table] }
          delete next[msg.id]
          useClinic.setState({ [msg.table]: next } as unknown as Partial<Tables>)
        }
      } else if (msg.type === 'SYNC') {
        useClinic.setState(msg.tables)
      }
    } finally {
      setTimeout(() => {
        remoteChangeCount = Math.max(0, remoteChangeCount - 1)
      }, 50)
    }
  }
}

// Cross-tab message handling via localStorage storage event
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === CLINIC_STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue) as Partial<Tables>
        const s = useClinic.getState()
        useClinic.setState({
          doctors: { ...s.doctors, ...(parsed.doctors || {}) },
          patients: { ...s.patients, ...(parsed.patients || {}) },
          messages: { ...s.messages, ...(parsed.messages || {}) },
          symptoms: { ...s.symptoms, ...(parsed.symptoms || {}) },
          labs: { ...s.labs, ...(parsed.labs || {}) },
          notes: { ...s.notes, ...(parsed.notes || {}) },
          access: { ...s.access, ...(parsed.access || {}) },
          alerts: { ...s.alerts, ...(parsed.alerts || {}) },
          medlogs: { ...s.medlogs, ...(parsed.medlogs || {}) },
        })
      } catch {}
    } else if (e.key === DOCTORS_STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue) as Record<string, Row<'doctors'>>
        useClinic.setState((s) => ({
          doctors: { ...s.doctors, ...parsed },
        }))
      } catch {}
    }
  })
}

// Remote changes tracker for patient notifications
let remoteChangeCount = 0
export const fromOtherTab = () => remoteChangeCount > 0

export type RealtimeChangePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | string
  new: Record<string, unknown>
  old: Record<string, unknown>
}

// 4. تطبيق التحديثات اللحظية من Realtime على الـ Store
export function applyChange<T extends Table>(table: T, change: RealtimeChangePayload) {
  remoteChangeCount += 1
  try {
    const s = useClinic.getState()
    if (change.eventType === 'DELETE') {
      const id = change.old?.id as string
      if (id && s[table]?.[id]) {
        const next = { ...s[table] }
        delete next[id]
        useClinic.setState({ [table]: next } as unknown as Partial<Tables>)
      }
    } else {
      const row = dbToRow<Row<T>>(change.new)
      const id = (row as { id?: string })?.id
      if (id) {
        useClinic.setState({
          [table]: {
            ...s[table],
            [id]: row,
          },
        } as unknown as Partial<Tables>)
      }
    }
  } finally {
    setTimeout(() => {
      remoteChangeCount = Math.max(0, remoteChangeCount - 1)
    }, 50)
  }
}

// 3. دالة التحميل الشامل ( loadAll )
// Answers true when the clinic server answered. Its rows win over everything else: every change from every phone
// is saved there.
export async function loadAll(): Promise<boolean> {
  const user = useAuth.getState().user
  const local = loadLocalTables()
  const next: Tables = {
    doctors: { ...SEED.doctors, ...(local.doctors || {}) },
    patients: { ...(local.patients || {}) },
    messages: { ...(local.messages || {}) },
    symptoms: { ...(local.symptoms || {}) },
    labs: { ...(local.labs || {}) },
    notes: { ...(local.notes || {}) },
    access: { ...(local.access || {}) },
    alerts: { ...(local.alerts || {}) },
    medlogs: { ...(local.medlogs || {}) },
  }

  // 1. جلب بيانات كل الجداول من السيرفر المركزي حتى تظهر لجميع الأجهزة المشبوكة على الرابط
  let reached = false
  let server: any = null
  try {
    const res = await clinicFetch('/api/clinic/tables')
    if (res.ok) {
      const serverTables = await res.json()
      if (serverTables && typeof serverTables === 'object') {
        reached = true
        server = serverTables
        for (const t of TABLES) {
          if (serverTables[t] && typeof serverTables[t] === 'object') {
            next[t] = { ...next[t], ...serverTables[t] }
          }
        }
      }
    }
  } catch {}

  // 2. مزامنة الأطباء أيضاً من /api/clinic/doctors
  try {
    const res = await clinicFetch('/api/clinic/doctors')
    if (res.ok) {
      const bDocs = await res.json()
      if (bDocs && typeof bDocs === 'object') {
        next.doctors = { ...next.doctors, ...bDocs }
      }
    }
  } catch {}

  useClinic.setState(next)
  saveLocalTables(next)

  if (!user) {
    return reached
  }

  const isDoctor = user.role === 'doctor'
  const pid = patientIdOf(user)

  try {
    // 3. تحميل بيانات الأطباء من Supabase إن وجدت
    const { data: doctorsData, error: docErr } = await supabase.from('doctors').select('*')
    if (!docErr && doctorsData && doctorsData.length > 0) {
      for (const d of doctorsData) {
        const row = dbToRow<Row<'doctors'>>(d)
        if (row?.id) next.doctors[row.id] = row
      }
    }

    if (isDoctor) {
      const docId = doctorIdOf(user)
      const { data: patientsData, error: pErr } = await supabase.from('patients').select('*')
      if (!pErr && patientsData && patientsData.length > 0) {
        for (const p of patientsData) {
          const row = dbToRow<Row<'patients'>>(p)
          if (row?.id) next.patients[row.id] = row
        }

        const childTables: Table[] = ['messages', 'symptoms', 'labs', 'notes', 'alerts', 'medlogs', 'access']
        await Promise.all(
          childTables.map(async (table) => {
            const { data, error } = await supabase.from(table).select('*')
            if (!error && data) {
              for (const item of data) {
                const row = dbToRow(item) as { id: string }
                if (row?.id) {
                  ;(next[table] as Record<string, unknown>)[row.id] = row
                }
              }
            }
          }),
        )
      } else if (docId === 'd_main' || user.email === 'doctor@clinic.com') {
        if (Object.keys(next.patients).length === 0) {
          next.patients = { ...SEED.patients }
          next.messages = { ...SEED.messages }
          next.symptoms = { ...SEED.symptoms }
          next.labs = { ...SEED.labs }
          next.notes = { ...SEED.notes }
          next.alerts = { ...SEED.alerts }
          next.medlogs = { ...SEED.medlogs }
          next.access = { ...SEED.access }
        }
      }
    } else {
      // للمريضة: جلب صفها الخاص
      if (pid) {
        const { data: pData, error: pErr } = await supabase.from('patients').select('*').eq('id', pid)
        if (!pErr && pData && pData.length > 0) {
          for (const p of pData) {
            const row = dbToRow<Row<'patients'>>(p)
            if (row?.id) next.patients[row.id] = row
          }
        } else if (!next.patients[pid] && SEED.patients[pid]) {
          next.patients[pid] = SEED.patients[pid]
        }

        const childTables: Table[] = ['messages', 'symptoms', 'labs', 'notes', 'alerts', 'medlogs', 'access']
        await Promise.all(
          childTables.map(async (table) => {
            const { data, error } = await supabase.from(table).select('*').eq('patient_id', pid)
            if (!error && data && data.length > 0) {
              for (const item of data) {
                const row = dbToRow(item) as { id: string }
                if (row?.id) {
                  ;(next[table] as Record<string, unknown>)[row.id] = row
                }
              }
            } else if (!next[table] || Object.keys(next[table]).length === 0) {
              if (SEED[table]) {
                for (const [id, item] of Object.entries(SEED[table] as Record<string, { pid?: string }>)) {
                  if (item.pid === pid) {
                    ;(next[table] as Record<string, unknown>)[id] = item
                  }
                }
              }
            }
          }),
        )
      }
    }

    // The clinic server's copy wins over Supabase's
    if (server) {
      for (const t of TABLES) {
        if (server[t] && typeof server[t] === 'object') next[t] = { ...next[t], ...server[t] }
      }
    }
    useClinic.setState(next)
    saveLocalTables(next)
  } catch (err) {
    console.warn('loadAll exception:', err)
  }
  return reached
}

// Rows read from the server go into this app's copy, without being sent back.
export function mergeRows(table: Table, rows: unknown) {
  if (!Array.isArray(rows) || !rows.length) return
  const s = useClinic.getState()
  const next = { ...(s[table] as Record<string, unknown>) }
  for (const row of rows as { id?: string }[]) {
    if (row && typeof row.id === 'string') next[row.id] = row
  }
  useClinic.setState({ [table]: next } as unknown as Partial<Tables>)
  saveLocalTables(useClinic.getState())
}

// 4. تفعيل التحديث اللحظي ( Realtime ) عبر Supabase Channels
// One live channel for whoever is signed in on this tab. Signing in starts it from more than one place (the sign-in
// screen, Supabase's own sign-in event, and the screens that open next), so another call for the same account does
// nothing. And each new channel gets a new name: Supabase takes a moment to close the old one, and asking for a
// channel by a name that is still open hands back the old, already-started channel, which refuses new listeners.
let activeChannel: RealtimeChannel | null = null
let activeName = ''
let channelCount = 0

export function subscribeRealtime(): () => void {
  const user = useAuth.getState().user
  const isDoctor = user?.role === 'doctor'
  const pid = user ? patientIdOf(user) : null
  const channelName = isDoctor ? 'clinic-doctor' : `clinic-patient-${pid || 'anon'}`

  if (user && activeChannel && activeName === channelName) return () => {}
  if (activeChannel) {
    supabase.removeChannel(activeChannel)
    activeChannel = null
    activeName = ''
  }
  if (!user) return () => {}

  channelCount += 1
  const channel = supabase.channel(`${channelName}-${channelCount}`)

  const childTables: Table[] = ['messages', 'symptoms', 'labs', 'notes', 'alerts', 'medlogs', 'access']

  try {
    if (isDoctor) {
      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'patients' },
          (change) => applyChange('patients', change as unknown as RealtimeChangePayload),
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'doctors' },
          (change) => applyChange('doctors', change as unknown as RealtimeChangePayload),
        )

      for (const table of childTables) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (change) => applyChange(table, change as unknown as RealtimeChangePayload),
        )
      }
    } else if (pid) {
      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'patients', filter: `id=eq.${pid}` },
          (change) => applyChange('patients', change as unknown as RealtimeChangePayload),
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'doctors' },
          (change) => applyChange('doctors', change as unknown as RealtimeChangePayload),
        )

      for (const table of childTables) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `patient_id=eq.${pid}` },
          (change) => applyChange(table, change as unknown as RealtimeChangePayload),
        )
      }
    }

    channel.subscribe((_status, err) => {
      if (err) console.warn(`Realtime channel [${channelName}] error:`, err)
    })
  } catch (err) {
    // Live updates are a convenience: without them the app still works (her data loads when she signs in).
    console.warn('Realtime subscribe failed:', err)
    supabase.removeChannel(channel)
    return () => {}
  }

  activeChannel = channel
  activeName = channelName

  // مزامنة دورية مع السيرفر المركزي كل 3 ثواني لنقل طلبات الربط بين الأجهزة المختلفة
  const pollTimer = setInterval(async () => {
    try {
      const res = await clinicFetch('/api/clinic/tables')
      if (res.ok) {
        const serverTables = await res.json()
        if (serverTables && typeof serverTables === 'object') {
          const s = useClinic.getState()
          let hasDiff = false
          const patch: Partial<Tables> = {}
          for (const t of TABLES) {
            const remoteRows = serverTables[t]
            if (remoteRows && typeof remoteRows === 'object') {
              for (const [id, row] of Object.entries(remoteRows)) {
                if (!s[t][id] || JSON.stringify(s[t][id]) !== JSON.stringify(row)) {
                  if (!patch[t]) patch[t] = { ...s[t] } as any
                  ;(patch[t] as Record<string, unknown>)[id] = row
                  hasDiff = true
                }
              }
            }
          }
          if (hasDiff) {
            remoteChangeCount += 1
            useClinic.setState(patch)
            saveLocalTables(useClinic.getState())
            setTimeout(() => {
              remoteChangeCount = Math.max(0, remoteChangeCount - 1)
            }, 100)
          }
        }
      }
    } catch {}
  }, 3500)

  return () => {
    clearInterval(pollTimer)
    if (activeChannel === channel) {
      supabase.removeChannel(channel)
      activeChannel = null
      activeName = ''
    }
  }
}

// Rows of one table as a list
export function listOf<T extends Table>(rows: Tables[T]): Row<T>[] {
  return Object.values(rows || {}) as Row<T>[]
}

// Start the demo again: removes non-demo patients
export function resetLive() {
  const patients = useClinic.getState().patients
  useClinic.getState().forget((pid) => !patients[pid]?.demo)
}

// Removes one patient's file for guest signOut
export function forgetPatient(id: string) {
  useClinic.getState().forget((pid) => pid === id)
}
