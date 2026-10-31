import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { deleteFilesOf } from '../lib/files'
import { supabase } from '../lib/supabase'
import { useAssessment } from './assessment'
import { useChat } from './chat'
import { forgetPatient, loadAll, subscribeRealtime } from './clinic'
import { useNotifications } from './notifications'
import { useReminder } from './reminder'
import { useTests } from './tests'

export type Role = 'patient' | 'doctor'

export type User = {
  role: Role
  email: string
  guest: boolean
  id?: string
}

type AuthState = {
  user: User | null
  login: (user: User) => void
  logout: () => Promise<void>
}

// Her file in the shared data: one per email, and one for a guest on this device.
export function patientIdOf(user: User | null): string | null {
  if (!user || user.role !== 'patient') return null
  if (user.guest || !user.email) return 'p_guest'
  return 'p_' + user.email.toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

// Doctor's id in shared data: one per email. Demo accounts use d_main.
export function doctorIdOf(user: User | null): string | null {
  if (!user || user.role !== 'doctor') return null
  if (user.email === 'doctor@clinic.com' || user.email === 'demo@doctor.com') return 'd_main'
  if (user.email) return 'd_' + user.email.toLowerCase().replace(/[^a-z0-9]+/g, '_')
  return user.id ? 'd_' + user.id : 'd_main'
}

// Her answers, uploads and reminder are kept in this browser, and stay there after she signs out, so the app
// knows her when she signs in again (before she links a doctor, they are not saved anywhere else). They are
// cleared only when a different patient signs in on this browser, so nobody sees another woman's answers.
const OWNER_KEY = 'maaki-owner'

function clearDeviceData() {
  useAssessment.getState().reset()
  useTests.getState().reset()
  useNotifications.getState().reset()
  useReminder.getState().reset()
  useChat.getState().reset()
}

// Called when a patient signs in. "adopt": the data already here is hers when no owner was written yet (it was
// written by this version of the app only), which happens once, on a refresh right after the update.
function claimDeviceData(user: User, adopt = false) {
  const pid = patientIdOf(user)
  if (!pid) return
  let owner: string | null = null
  try {
    owner = localStorage.getItem(OWNER_KEY)
  } catch {
    // no storage: nothing to compare
  }
  if (owner === pid) return
  if (!(adopt && owner === null)) clearDeviceData()
  try {
    localStorage.setItem(OWNER_KEY, pid)
  } catch {
    // ignore
  }
}

// When a patient signs out. A guest's data lives on this device only and has no account to come back to, so it
// goes with her. An email account keeps hers for the next time she signs in.
function afterSignOut(user: User | null) {
  if (!user || user.role !== 'patient') return
  if (user.guest) {
    forgetPatient('p_guest')
    deleteFilesOf('p_guest').catch(() => undefined)
    clearDeviceData()
    try {
      localStorage.removeItem(OWNER_KEY)
    } catch {
      // ignore
    }
  } else {
    useChat.getState().reset() // the conversation with Wanas is never kept
  }
}

// Who is signed in. It is remembered in this browser (localStorage) like any app: she stays signed in after
// closing the tab or the browser, until she signs out.
export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      login: (user) => {
        claimDeviceData(user)
        set({ user })
        loadAll()
        subscribeRealtime()
      },
      logout: async () => {
        try {
          await supabase.auth.signOut()
        } catch {
          // ignore
        }
        afterSignOut(get().user)
        set({ user: null })
        loadAll()
      },
    }),
    { name: 'maaki-auth', storage: createJSONStorage(() => localStorage) },
  ),
)

// The tab she picked on the sign-in screen (patient or doctor). The sign-in screen sets it before signing in,
// because Supabase's sign-in event below fires before the sign-in screen hears back.
let chosenRole: Role | null = null
export function chooseRole(role: Role) {
  chosenRole = role
}

// While the sign-in screen signs someone in, it finds out from the clinic which kind of account the email is, and
// opens the app itself. Supabase's sign-in event below waits for it, so the app doesn't open on the wrong side.
let held = false
export function holdSignIn(on: boolean) {
  held = on
}

// The tab used last on this device (patient or doctor), so the sign-in screen opens on it next time.
const ROLE_KEY = 'maaki-last-role'
export function rememberRole(role: Role) {
  try {
    localStorage.setItem(ROLE_KEY, role)
  } catch {
    // ignore
  }
}
export function lastRole(): Role {
  try {
    return localStorage.getItem(ROLE_KEY) === 'doctor' ? 'doctor' : 'patient'
  } catch {
    return 'patient'
  }
}

// The first screen for each kind of account.
export function homeFor(role: Role) {
  return role === 'doctor' ? '/dashboard' : '/home'
}

// 4. متابعة حالة المستخدم (هل هو مسجل الدخول أم لا؟)
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session?.user) {
    const isGuest = session.user.is_anonymous ?? false
    const current = useAuth.getState().user
    // The tab she picked on the sign-in screen decides, so one account can be a patient in one tab and a doctor in another
    const role: Role = current?.role || chosenRole || (session.user.user_metadata?.role as Role) || 'patient'
    const user: User = { role, email: session.user.email || '', guest: isGuest, id: session.user.id }
    claimDeviceData(user, true)
    useAuth.setState({ user })
    loadAll()
    subscribeRealtime()
  }
})

supabase.auth.onAuthStateChange((event, session) => {
  if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
    if (held) return // the sign-in screen opens the app itself
    const isGuest = session.user.is_anonymous ?? false
    const current = useAuth.getState().user
    // The tab she picked on the sign-in screen decides, so one account can be a patient in one tab and a doctor in another
    const role: Role = current?.role || chosenRole || (session.user.user_metadata?.role as Role) || 'patient'
    const user: User = { role, email: session.user.email || '', guest: isGuest, id: session.user.id }
    claimDeviceData(user, true)
    useAuth.setState({ user })
    loadAll()
    subscribeRealtime()
  } else if (event === 'SIGNED_OUT') {
    afterSignOut(useAuth.getState().user)
    useAuth.setState({ user: null })
    loadAll()
  }
})
