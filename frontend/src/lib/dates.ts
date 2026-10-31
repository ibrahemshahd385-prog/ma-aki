// Dates and times in Egyptian Arabic, the way the prototype shows them.

export const DAY = 86400000
const LOCALE = 'ar-EG-u-nu-latn' // Arabic month and day names, with 0-9 digits

// Something with a time: either a real date (at) or, in the demo data, "so many days ago" (ago).
export type Timed = { at?: string; ago?: number }

export const isoNow = () => new Date().toISOString()

// The moment something happened, in milliseconds.
export function tOf(x: Timed | null | undefined) {
  if (x && x.at) return Date.parse(x.at)
  return Date.now() - ((x && x.ago) || 0) * DAY
}

export const byTime = (a: Timed, b: Timed) => tOf(a) - tOf(b)

// 2026-10-26
export function ymd(d: Date) {
  const p = (n: number) => (n < 10 ? '0' : '') + n
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

// A plan step or an appointment has a fixed date, or (demo data) "in so many days".
export type DateLike = { date?: string; inDays?: number; time?: string }

export function dateOfRel(x: DateLike) {
  if (x.date) return new Date(x.date + 'T' + (x.time || '09:00'))
  const d = new Date(Date.now() + (x.inDays || 0) * DAY)
  if (x.time) {
    const [h, m] = x.time.split(':')
    d.setHours(Number(h) || 0, Number(m) || 0, 0, 0)
  }
  return d
}

// Arabic counting: 1 and 2 have their own words, 3 to 10 take the plural, 11 and up the singular.
export function plural(n: number, one: string, two: string, few: string, many: string) {
  if (n === 1) return one
  if (n === 2) return two
  if (n >= 3 && n <= 10) return n + ' ' + few
  return n + ' ' + many
}

export const fmtDay = (ms: number) => new Date(ms).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' })
export const fmtDayShort = (ms: number) => new Date(ms).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })
export const fmtDayLong = (ms: number) => new Date(ms).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' })
export const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' })

// Today: just the time. Another day: the day and the time.
export function fmtWhen(ms: number) {
  return ymd(new Date(ms)) === ymd(new Date()) ? fmtTime(ms) : fmtDay(ms) + ' · ' + fmtTime(ms)
}

export function fmtAgo(ms: number) {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60000))
  if (m < 1) return 'دلوقتي'
  if (m < 60) return 'من ' + plural(m, 'دقيقة', 'دقيقتين', 'دقايق', 'دقيقة')
  const h = Math.round(m / 60)
  if (h < 24) return 'من ' + plural(h, 'ساعة', 'ساعتين', 'ساعات', 'ساعة')
  const d = Math.round(h / 24)
  return d === 1 ? 'امبارح' : 'من ' + plural(d, 'يوم', 'يومين', 'أيام', 'يوم')
}

// "النهارده", "بكرة", "بعد 5 أيام", "من يومين"
export function fmtIn(ms: number) {
  const a = new Date()
  a.setHours(0, 0, 0, 0)
  const b = new Date(ms)
  b.setHours(0, 0, 0, 0)
  const d = Math.round((b.getTime() - a.getTime()) / DAY)
  if (d === 0) return 'النهارده'
  if (d === 1) return 'بكرة'
  if (d === -1) return 'امبارح'
  if (d > 1) return 'بعد ' + plural(d, 'يوم', 'يومين', 'أيام', 'يوم')
  return 'من ' + plural(-d, 'يوم', 'يومين', 'أيام', 'يوم')
}

export type Hours = { from: number; to: number }

function fmtHour(n: number) {
  if (n === 0) return '12 بالليل'
  if (n < 12) return n + ' الصبح'
  if (n === 12) return '12 الضهر'
  return n - 12 + (n < 18 ? ' العصر' : ' بالليل')
}

export function hoursText(h?: Hours) {
  const x = h || { from: 10, to: 16 }
  return 'من ' + fmtHour(x.from) + ' لـ ' + fmtHour(x.to)
}

export function isOfficeHours(h?: Hours) {
  const x = h || { from: 10, to: 16 }
  const hr = new Date().getHours()
  return hr >= x.from && hr < x.to
}

// "08:00" as a clock time today, like "8:00 ص".
export function clockLabel(tm: string) {
  return fmtTime(Date.parse(ymd(new Date()) + 'T' + tm))
}
