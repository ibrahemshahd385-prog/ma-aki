// Arabic and English. The app is written in Arabic; in English, the screen shows the English for each Arabic text
// (data/en.ts) as it appears, and the page turns left-to-right. What is saved (her answers, messages, the doctor's
// notes) stays as it was written, so the doctor and the patient can each use their own language.
import { EN, EN_TEMPLATES } from '../data/en'

export type Lang = 'ar' | 'en'
const KEY = 'maaki-lang'

function readLang(): Lang {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'ar'
  } catch {
    return 'ar'
  }
}

const current: Lang = readLang()
export const getLang = () => current
export const isEnglish = () => current === 'en'

// Changing the language opens the app again in it, on the same screen.
export function setLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang)
  } catch {
    // ignore
  }
  window.location.reload()
}

/* ---------- finding the English for a text ---------- */

const AR = /[؀-ۿ]/
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Texts with parts that change: the Arabic with {0}, {1} ... becomes a pattern, longest first. Made only in English.
type Template = { re: RegExp; en: string; order: number[]; weight: number }
let TEMPLATES: Template[] = []
// Every known Arabic phrase, longest first, to put together a text made of several of them
let PHRASE_RE: RegExp | null = null

function prepare() {
  TEMPLATES = EN_TEMPLATES.map(([ar, en]) => {
    const parts = norm(ar).split(/\{(\d+)\}/)
    let source = '^'
    const order: number[] = []
    parts.forEach((p, i) => {
      if (i % 2 === 0) source += escape(p)
      else {
        source += '(.+?)'
        order.push(Number(p))
      }
    })
    return { re: new RegExp(source + '$'), en, order, weight: parts.filter((_, i) => i % 2 === 0).join('').length }
  }).sort((a, b) => b.weight - a.weight)
  const phrases = Object.keys(EN)
    .filter((k) => k.length >= 3)
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join('|')
  try {
    PHRASE_RE = new RegExp('(?<![\\u0600-\\u06FF])(' + phrases + ')(?![\\u0600-\\u06FF])', 'g')
  } catch {
    PHRASE_RE = new RegExp('(' + phrases + ')', 'g') // an older browser without look-behind
  }
}

// Times and counts the app writes out in words
const HOUR = '(12 بالليل|12 الضهر|\\d{1,2} الصبح|\\d{1,2} العصر|\\d{1,2} بالليل)'
const hourEn = (h: string) =>
  h === '12 بالليل'
    ? '12 AM'
    : h === '12 الضهر'
      ? '12 PM'
      : h.replace(/^(\d+) الصبح$/, '$1 AM').replace(/^(\d+) (العصر|بالليل)$/, '$1 PM')
const RULES: [RegExp, string | ((...m: string[]) => string)][] = [
  [new RegExp('من ' + HOUR + ' لـ ' + HOUR, 'g'), (_, a, b) => `from ${hourEn(a)} to ${hourEn(b)}`],
  [/^من دقيقة$/, 'a minute ago'],
  [/^من دقيقتين$/, '2 minutes ago'],
  [/^من (\d+) (?:دقايق|دقيقة)$/, '$1 minutes ago'],
  [/^من ساعة$/, 'an hour ago'],
  [/^من ساعتين$/, '2 hours ago'],
  [/^من (\d+) (?:ساعات|ساعة)$/, '$1 hours ago'],
  [/^من يوم$/, 'a day ago'],
  [/^من يومين$/, '2 days ago'],
  [/^من (\d+) (?:أيام|يوم)$/, '$1 days ago'],
  [/^بعد يومين$/, 'in 2 days'],
  [/^بعد (\d+) (?:أيام|يوم)$/, 'in $1 days'],
  [/^بعد شهر$/, 'in a month'],
  [/^بعد شهرين$/, 'in 2 months'],
  [/^بعد (\d+) (?:شهور|شهر)$/, 'in $1 months'],
  [/^بعد سنة$/, 'in a year'],
  [/(\d+) (?:جرعات|جرعة)/g, '$1 doses'],
  [/(\d+) (?:أيام|يوم)/g, '$1 days'],
  [/(\d+) (?:ساعات|ساعة)/g, '$1 hours'],
  [/(\d+) (?:دقايق|دقيقة)/g, '$1 minutes'],
  [/(\d+) (?:رسايل جديدة|رسالة جديدة)/g, '$1 new messages'],
  [/(\d+) سنة/g, '$1 years'],
]

function applyRules(t: string) {
  let out = t
  for (const [re, to] of RULES) out = out.replace(re, to as never)
  return out
}

function lookup(t: string, depth = 0): string | null {
  const hit = EN[t]
  if (hit !== undefined) return hit
  // A text with a part that changes
  for (const p of TEMPLATES) {
    const m = p.re.exec(t)
    if (!m) continue
    return p.en.replace(/\{(\d+)\}/g, (_, n) => {
      const value = m[p.order.indexOf(Number(n)) + 1] ?? ''
      return AR.test(value) && depth < 3 ? (lookup(norm(value), depth + 1) ?? value) : value
    })
  }
  // Times and counts written in words
  const ruled = applyRules(t)
  if (!AR.test(ruled)) return ruled
  // Pieces joined with "·", "،" or ":", each one known
  const pieces = ruled.split(/(\s*·\s*|،\s*|:\s+)/)
  if (pieces.length > 1) {
    const done = pieces.map((p, i) => (i % 2 === 1 ? p.replace('،', ',') : AR.test(p) ? lookup(norm(p), depth + 1) : p))
    if (done.every((p) => p !== null)) return done.join('')
  }
  // Known phrases inside the text: used only when nothing Arabic is left
  if (PHRASE_RE) {
    const joined = ruled.replace(PHRASE_RE, (k) => EN[k]).replace(/،/g, ',')
    if (!AR.test(joined)) return joined
  }
  return null
}

const cache = new Map<string, string | null>()
export function translate(raw: string): string | null {
  if (!AR.test(raw)) return null
  const t = norm(raw)
  let en = cache.get(t)
  if (en === undefined) {
    en = lookup(t)
    cache.set(t, en)
  }
  if (en === null) return null
  const lead = raw.match(/^\s*/)?.[0] ?? ''
  const trail = raw.match(/\s*$/)?.[0] ?? ''
  return lead + en + trail
}

/* ---------- the screen ---------- */

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT'])
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt']
const set = new WeakMap<Node, string>() // the English this layer wrote, so its own change isn't looked at again

function skipped(el: Element | null) {
  for (let e = el; e; e = e.parentElement) {
    if (SKIP.has(e.tagName) || e.hasAttribute('data-no-translate')) return true
  }
  return false
}

function doText(node: Text) {
  const v = node.nodeValue || ''
  if (!AR.test(v) || set.get(node) === v || skipped(node.parentElement)) return
  const en = translate(v)
  if (en !== null && en !== v) {
    set.set(node, en)
    node.nodeValue = en
  }
}

function doElement(el: Element) {
  if (el.getAttribute('dir') === 'rtl') el.setAttribute('dir', 'ltr')
  if (skipped(el)) return
  for (const a of ATTRS) {
    const v = el.getAttribute(a)
    if (!v || !AR.test(v)) continue
    const en = translate(v)
    if (en !== null && en !== v) el.setAttribute(a, en)
  }
}

function walk(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) return doText(node as Text)
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const el = node as Element
  doElement(el)
  if (SKIP.has(el.tagName) || el.hasAttribute('data-no-translate')) return
  for (let c = el.firstChild; c; c = c.nextSibling) walk(c)
}

// Dates in English too: the app asks for Arabic ones ("ar-EG")
function englishDates() {
  const fix = (locale: unknown) => (typeof locale === 'string' && locale.startsWith('ar') ? 'en-US' : locale)
  for (const name of ['toLocaleDateString', 'toLocaleTimeString', 'toLocaleString'] as const) {
    const original = Date.prototype[name] as (this: Date, locale?: unknown, options?: unknown) => string
    ;(Date.prototype as unknown as Record<string, unknown>)[name] = function (this: Date, locale?: unknown, options?: unknown) {
      return original.call(this, fix(locale), options)
    }
  }
}

// Called once before the app draws anything. In Arabic it does nothing.
export function startTranslator() {
  if (current !== 'en') return
  prepare()
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
  document.title = "Ma'aki"
  // Arrows point the other way when the page reads left to right
  const style = document.createElement('style')
  style.textContent = '[data-flip]{transform:scaleX(-1)}'
  document.head.appendChild(style)
  englishDates()
  walk(document.body)
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') doText(r.target as Text)
      else if (r.type === 'attributes') doElement(r.target as Element)
      else r.addedNodes.forEach(walk)
    }
  }).observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS, 'dir'],
  })
}
