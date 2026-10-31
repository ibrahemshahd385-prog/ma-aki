import type { TestId } from '../data/tests'
import { clinicFetch } from './api'

// Where uploaded files are kept: in this browser (IndexedDB, a storage that holds big files), and on our server
// (backend/app/routers/clinic.py), so her doctor opens them from any phone or computer, not only from this browser.
// (localStorage is too small for pictures: about 5 MB for everything.)

export type StoredFile = {
  key: string // her file + the box, like "p_guest/mammo"
  pid: string
  test: TestId
  name: string
  type: string // like "image/jpeg" or "application/pdf"
  size: number
  at: string
  blob: Blob
}

const DB_NAME = 'maaki-files'
const STORE = 'files'

let opening: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!opening) {
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' }).createIndex('pid', 'pid')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    opening.catch(() => {
      opening = null // try again next time
    })
  }
  return opening
}

// Runs some work in one transaction and waits until it is saved, so another tab can read it right after.
function inTransaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        let result: T | undefined
        const req = work(tx.objectStore(STORE))
        if (req) req.onsuccess = () => (result = req.result)
        tx.oncomplete = () => resolve(result)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

export const fileKey = (pid: string, test: TestId) => pid + '/' + test

const serverPath = (key: string) => '/api/clinic/files/' + key.split('/').map(encodeURIComponent).join('/')

// The file goes to the server, so the doctor sees it from any device. Tried twice; a guest has no account there.
async function sendToServer(file: StoredFile) {
  if (file.pid === 'p_guest') return
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const form = new FormData()
      form.append('file', file.blob, file.name)
      form.append('at', file.at)
      const res = await clinicFetch(serverPath(file.key), { method: 'PUT', body: form })
      if (res.ok) return
    } catch {
      // no server right now
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
}

export async function saveFile(file: StoredFile) {
  await inTransaction('readwrite', (s) => s.put(file))
  await sendToServer(file)
}

// The file from the server: for the doctor (the file was uploaded on the patient's phone), or for the patient on
// another phone.
async function fromServer(key: string): Promise<StoredFile | null> {
  try {
    const res = await clinicFetch(serverPath(key))
    if (!res.ok) return null
    const blob = await res.blob()
    const [pid, test] = key.split('/')
    const header = (name: string) => {
      try {
        return decodeURIComponent(res.headers.get(name) || '')
      } catch {
        return ''
      }
    }
    return { key, pid, test: test as TestId, name: header('X-File-Name') || test, type: blob.type, size: blob.size, at: header('X-File-At'), blob }
  } catch {
    return null
  }
}

// "at": when the file the app expects was uploaded; a copy here from another time is old, so the server's is used.
// "remote": false keeps it to this browser (for small previews, without downloading big scans).
export async function getFile(key: string, options: { at?: string; remote?: boolean } = {}): Promise<StoredFile | null> {
  const here = (await inTransaction<StoredFile>('readonly', (s) => s.get(key)).catch(() => undefined)) ?? null
  if (here && (!options.at || here.at === options.at)) return here
  if (options.remote === false) return here
  return (await fromServer(key)) ?? here
}

export async function deleteFile(key: string) {
  await inTransaction('readwrite', (s) => s.delete(key))
  if (!key.startsWith('p_guest/')) clinicFetch(serverPath(key), { method: 'DELETE' }).catch(() => undefined)
}

// All the files of one patient (for a guest who signs out, or "start the demo again").
export async function deleteFilesOf(pid: string) {
  await inTransaction('readwrite', (s) => {
    const req = s.index('pid').openCursor(IDBKeyRange.only(pid))
    req.onsuccess = () => {
      const cursor = req.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
  })
}

// "2.4 ميجا", "180 كيلو"
export function sizeText(bytes: number) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' ميجا'
  return Math.max(1, Math.round(bytes / 1024)) + ' كيلو'
}
