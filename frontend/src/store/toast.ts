import { create } from 'zustand'

type ToastState = { text: string; show: (text: string) => void }

let timer = 0

// A short message at the bottom of the screen ("طلب الربط اتبعت") that goes away by itself.
export const useToast = create<ToastState>()((set) => ({
  text: '',
  show: (text) => {
    window.clearTimeout(timer)
    set({ text })
    timer = window.setTimeout(() => set({ text: '' }), 2800)
  },
}))

export const toast = (text: string) => useToast.getState().show(text)
