import { createClient } from '@supabase/supabase-js'

// The sign-in is remembered in this browser (localStorage, Supabase's default), so she stays signed in after
// closing the app or the browser, until she signs out.
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
