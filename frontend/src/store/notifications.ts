import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Note = { id: string; title: string; text: string; at: string; read: boolean }

type NotesState = {
  notes: Note[] // newest first
  add: (title: string, text: string) => void
  markAllRead: () => void
  reset: () => void
}

function makeNote(title: string, text: string): Note {
  // A simple unique id (crypto.randomUUID only works on https or localhost).
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  return { id, title, text, at: new Date().toISOString(), read: false }
}

const welcome = () => makeNote('أهلاً بيكي في معاكِ', 'هنفكّرك بالفحص الذاتي كل شهر، وإحنا معاكِ في كل خطوة.')

// The messages under the bell. Other parts of the app call add() when something happens.
export const useNotifications = create<NotesState>()(
  persist(
    (set) => ({
      notes: [welcome()],
      add: (title, text) => set((s) => ({ notes: [makeNote(title, text), ...s.notes].slice(0, 50) })),
      // Returning the same state when nothing changed means nothing redraws.
      markAllRead: () => set((s) => (s.notes.every((n) => n.read) ? s : { notes: s.notes.map((n) => ({ ...n, read: true })) })),
      reset: () => set({ notes: [welcome()] }),
    }),
    { name: 'maaki-notifications' },
  ),
)
