import { clockLabel, ymd } from './dates'
import { getMine, getMyRecord } from '../store/doctor'
import { useNotifications } from '../store/notifications'
import { toast } from '../store/toast'
import type { Med } from '../data/clinic'

const NOTIFIED_DOSES_KEY = 'maaki_notified_doses'

// Get set of dose identifiers that were already notified today: "YYYY-MM-DD_medId_HH:MM"
function getNotifiedDoses(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_DOSES_KEY)
    if (!raw) return new Set()
    const list = JSON.parse(raw) as string[]
    return new Set(list)
  } catch {
    return new Set()
  }
}

function markDoseNotified(key: string) {
  try {
    const set = getNotifiedDoses()
    set.add(key)
    // Keep last 150 items so storage doesn't grow indefinitely
    const arr = Array.from(set).slice(-150)
    localStorage.setItem(NOTIFIED_DOSES_KEY, JSON.stringify(arr))
  } catch {}
}

/**
 * Plays a gentle, pleasant 2-tone melodic chime using Web Audio API (no external audio files needed).
 */
export function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    // First soft bell tone (E5 ~ 659.25 Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(659.25, now)
    gain1.gain.setValueAtTime(0.12, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.35)

    // Second soft bell tone (A5 ~ 880 Hz)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(880, now + 0.15)
    gain2.gain.setValueAtTime(0.15, now + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.15)
    osc2.stop(now + 0.6)
  } catch {
    // Graceful fallback if audio is restricted before interaction
  }
}

/**
 * Returns current browser notification permission status.
 */
export function getNotificationPermission(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

/**
 * Requests browser notification permission and sends confirmation if granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    toast('المتصفح لا يدعم إشعارات النظام')
    return false
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      playNotificationChime()
      toast('تم تفعيل إشعارات مواعيد الأدوية بنجاح 🔔')
      useNotifications
        .getState()
        .add(
          'تم تفعيل إشعارات الأدوية 🔔',
          'هنفكّرك بكل جرعة في ميعادها المحدد على مدار اليوم إن شاء الله.',
        )

      try {
        new Notification('معاكِ 🌸 - مواعيد الأدوية', {
          body: 'تم تفعيل التنبيهات بنجاح! هتوصلك إشعارات بمواعيد علاجك أول بأول.',
          icon: '/favicon.ico',
        })
      } catch {}
      return true
    } else if (permission === 'denied') {
      toast('تم حظر الإشعارات. يمكنك السماح بها من إعدادات المتصفح.')
      return false
    }
  } catch {}
  return false
}

/**
 * Triggers full multi-channel notification for a specific medication dose.
 */
export function triggerMedNotification(med: Med, time: string) {
  const timeLabel = clockLabel(time)
  const medText = `حان موعد جرعة ${med.name} (${med.dose}) الساعة ${timeLabel}${med.note ? ' · ' + med.note : ''}. متنسيش تاخدي الجرعة وتسجليها في متابعتك!`

  // 1. In-app notification list under the bell icon
  useNotifications.getState().add(`موعد الدواء: ${med.name} 💊`, medText)

  // 2. On-screen toast banner
  toast(`⏰ حان موعد دواء ${med.name} (${med.dose})`)

  // 3. Audio chime
  playNotificationChime()

  // 4. Browser native system notification (works even if window is blurred/minimized)
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(`معاكِ 🌸 - موعد دواء ${med.name}`, {
        body: `جرعة ${med.dose} الساعة ${timeLabel}${med.note ? ' (' + med.note + ')' : ''}`,
        icon: '/favicon.ico',
        tag: `med-${med.id}-${ymd(new Date())}-${time}`,
      })
    } catch {}
  }
}

/**
 * Checks all prescribed medications for the current patient and triggers notifications
 * for any dose whose scheduled time has arrived today and has not been taken or notified yet.
 */
export function checkMedDoses() {
  const p = getMyRecord()
  if (!p || !p.meds || !p.meds.length) return

  const today = ymd(new Date())
  const now = Date.now()
  const logs = getMine('medlogs')
  const notified = getNotifiedDoses()

  for (const m of p.meds) {
    if (!m.times || !m.times.length) continue
    for (const tm of m.times) {
      // 1. Skip if patient already took this dose today
      const taken = logs.some((l) => l.medId === m.id && l.day === today && l.time === tm)
      if (taken) continue

      // 2. Skip if we already sent a notification for this dose today
      const doseKey = `${today}_${m.id}_${tm}`
      if (notified.has(doseKey)) continue

      // 3. Parse scheduled time for today
      const doseTimeMs = Date.parse(`${today}T${tm}:00`)
      if (isNaN(doseTimeMs)) continue

      const diff = now - doseTimeMs

      // If scheduled time has arrived and is within 45 minutes of scheduled time
      if (diff >= 0 && diff <= 45 * 60 * 1000) {
        markDoseNotified(doseKey)
        triggerMedNotification(m, tm)
      }
    }
  }
}

/**
 * Starts a recurring background service that monitors medication times every 15 seconds
 * and checks immediately when the page becomes visible.
 */
export function startMedReminderService(): () => void {
  // Check immediately
  checkMedDoses()

  // Recurring check every 15 seconds
  const intervalId = window.setInterval(() => {
    checkMedDoses()
  }, 15000)

  // Wake up and check as soon as tab comes to foreground
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      checkMedDoses()
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    window.clearInterval(intervalId)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}
