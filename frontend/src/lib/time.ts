// "من 5 دقايق", "من ساعتين", "امبارح"... In Arabic, 3 to 10 take the plural and 11 and up the singular.
function count(n: number, one: string, two: string, few: string, many: string) {
  if (n === 1) return one
  if (n === 2) return two
  return n <= 10 ? `${n} ${few}` : `${n} ${many}`
}

// How long ago something happened, the way people say it.
export function timeAgo(iso: string, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (seconds < 60) return 'دلوقتي'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return 'من ' + count(minutes, 'دقيقة', 'دقيقتين', 'دقايق', 'دقيقة')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return 'من ' + count(hours, 'ساعة', 'ساعتين', 'ساعات', 'ساعة')
  const days = Math.round(hours / 24)
  if (days === 1) return 'امبارح'
  if (days <= 10) return 'من ' + count(days, 'يوم', 'يومين', 'أيام', 'يوم')
  return new Date(iso).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'long' })
}

// A day written out, like "الجمعة، 30 أكتوبر".
export function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' })
}
