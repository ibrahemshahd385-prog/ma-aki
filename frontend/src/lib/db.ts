// Field name translation between Supabase (snake_case) and Frontend (camelCase / custom keys)

export const TO_DB_FIELDS: Record<string, string> = {
  pid: 'patient_id',
  from: 'sender',
  readP: 'read_p',
  readD: 'read_d',
  doctorId: 'doctor_id',
  requestedAt: 'requested_at',
  linkedAt: 'linked_at',
  updatedAt: 'updated_at',
  closedAt: 'closed_at',
  medId: 'med_id',
  syndicateNo: 'syndicate_no',
  demoAdherence: 'demo_adherence',
}

export const FROM_DB_FIELDS: Record<string, string> = {
  patient_id: 'pid',
  sender: 'from',
  read_p: 'readP',
  read_d: 'readD',
  doctor_id: 'doctorId',
  requested_at: 'requestedAt',
  linked_at: 'linkedAt',
  updated_at: 'updatedAt',
  closed_at: 'closedAt',
  med_id: 'medId',
  syndicate_no: 'syndicateNo',
  demo_adherence: 'demoAdherence',
}

export function toDbField(field: string): string {
  return TO_DB_FIELDS[field] || field.replace(/[A-Z]/g, (letter) => '_' + letter.toLowerCase())
}

export function fromDbField(field: string): string {
  return FROM_DB_FIELDS[field] || field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

export function rowToDb<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined) continue
    out[toDbField(key)] = value
  }
  return out
}

export function dbToRow<T = Record<string, unknown>>(dbRow: Record<string, unknown>): T {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(dbRow)) {
    out[fromDbField(key)] = value
  }
  return out as T
}
