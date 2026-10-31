import { create } from 'zustand'
import { LEVELS, scoreAssessment } from '../data/assessment'
import { apptsOf, labFlag, planInfo, receptorText, type Patient } from '../data/clinic'
import { TEST_SLOTS } from '../data/tests'
import { respond, welcome, type Card, type Conversation, type FollowInfo, type Reply, type WanasContext } from '../data/wanas'
import { askWanesAI } from '../lib/api'
import { isEnglish } from '../lib/i18n'
import { clockLabel, dateOfRel, fmtDay, fmtIn, hoursText, tOf } from '../lib/dates'
import { dayLabel } from '../lib/time'
import { useAssessment } from './assessment'
import { getMine, getMode, getMyDoctor, getMyRecord } from './doctor'
import { currentJourney } from './journey'
import { useNotifications } from './notifications'
import { useReminder } from './reminder'
import { hasScan, useTests } from './tests'

export type ChatMessage = { id: string; from: 'bot' | 'user'; text: string; card?: Card }

type ChatState = {
  messages: ChatMessage[]
  chips: string[]
  typing: boolean // Wanas is "writing"
  started: boolean
  convo: Conversation
  start: (ask?: string) => void
  send: (text: string) => void
  reset: () => void
}

const FRESH: Conversation = { awaiting: null, coachStep: 0, flagged: false }

// What Claude gets for a question the written replies don't cover: the question, the last few messages, and a
// line about where she is in the app. No name, email or files.
function claudePrompt(question: string, c: WanasContext, history: ChatMessage[]) {
  const where =
    c.mode === 'follow'
      ? 'المريضة في مرحلة العلاج والمتابعة.'
      : c.analyzed
        ? 'المريضة رفعت أشعة واتحللت في التطبيق، ولسه ما اتشخصتش.'
        : 'المريضة لسه ما اتشخصتش.'
  const recent = history
    .slice(-6)
    .map((m) => (m.from === 'user' ? 'المريضة: ' : 'ونس: ') + m.text)
    .join('\n')
  const how = isEnglish()
    ? 'The app is in English: reply in simple English, in 3 to 5 short sentences.'
    : 'ردي بالعامية المصرية في 3 لـ 5 جمل قصيرة.'
  return `${where}\nآخر الرسائل:\n${recent}\n\nسؤالها دلوقتي: ${question}\n${how}`
}
let timers: number[] = []
let counter = 0
const newId = () => 'm' + ++counter

// During treatment: her plan, medicines, the doctor's latest note and her lab results, written out for Wanas.
function followInfo(p: Patient): FollowInfo {
  const dx = p.diagnosis
  const cur = planInfo(p).cur
  const next = apptsOf(p).find((a) => a.t >= Date.now() - 3600000)
  const meds = p.meds || []
  const notes = getMine('notes')
  return {
    stage: dx?.stage || '',
    receptors: receptorText(dx),
    hormonal: !!(dx?.er || dx?.pr),
    her2: !!dx?.her2,
    grade: dx?.grade || '',
    current: cur ? cur.title + ' · ' + fmtIn(dateOfRel(cur).getTime()) : null,
    nextAppt: next ? next.title + ' · ' + fmtIn(next.t) : null,
    doses: meds.reduce((n, m) => n + m.times.length, 0),
    meds: meds.map((m) => m.name + ' · ' + m.dose + ' · ' + m.times.map(clockLabel).join(' و ')),
    lastNote: notes.length ? notes[notes.length - 1].text : null,
    labs: getMine('labs')
      .slice(-4)
      .reverse()
      .map((l) => `${l.test}: ${l.value} ${l.unit} · ${fmtDay(tOf(l))}` + (labFlag(l) ? ' · برّه المرجعي' : '')),
  }
}

// Everything Wanas needs to know about her, read from the other stores.
function context(): WanasContext {
  const a = useAssessment.getState()
  const t = useTests.getState()
  const result = scoreAssessment(a.age, a.chronic, a.answers)
  const mode = getMode()
  const doctor = getMyDoctor()
  const record = getMyRecord()
  const uploads = TEST_SLOTS.filter((s) => t.uploads[s.id]).map((s) => s.title)
  const journey = currentJourney()
  return {
    name: a.name.trim() || 'جميلة',
    assessed: a.done,
    level: result.level,
    levelLabel: LEVELS[result.level].label,
    levelMessage: LEVELS[result.level].message,
    factors: result.factors,
    age: parseInt(a.age, 10) || 0,
    familyHistory: a.answers.fam === 1 || a.answers.fam === 2,
    mode,
    doctorName: doctor ? doctor.name : null,
    doctorPlace: doctor ? [doctor.specialty, doctor.hospital].filter(Boolean).join(' · ') : '',
    doctorPhone: doctor && doctor.phone ? doctor.phone : null,
    doctorHours: hoursText(doctor?.hours),
    uploads,
    hasScan: hasScan(t.uploads),
    analyzed: t.analyzed && hasScan(t.uploads),
    biopsy: !!t.uploads.bio,
    journeyKey: journey.key,
    journeyMessage: journey.message,
    follow: mode === 'follow' && record ? followInfo(record) : null,
    reminderEvery: useReminder.getState().everyMonths,
  }
}

// The conversation with Wanas. It lives only while the app is open (it is not saved).
export const useChat = create<ChatState>()((set, get) => {
  // Shows Wanas's messages one at a time, with "typing" in between, the way a person writes.
  function deliver(reply: Reply, then?: string) {
    set({ typing: true, chips: [] })
    let at = 0
    reply.messages.forEach((m, i) => {
      at += Math.min(1400, 500 + (m.text.length + (m.card ? 80 : 0)) * 6)
      const last = i === reply.messages.length - 1
      const timer = window.setTimeout(() => {
        set((s) => ({ messages: [...s.messages, { id: newId(), from: 'bot', text: m.text, card: m.card }], typing: !last }))
        if (!last) return
        set((s) => ({
          chips: reply.chips,
          convo: {
            awaiting: reply.awaiting ?? null,
            coachStep: reply.coachStep ?? s.convo.coachStep,
            flagged: reply.flagged ?? s.convo.flagged,
          },
        }))
        if (reply.reminderEvery) useReminder.getState().setEvery(reply.reminderEvery)
        if (reply.reminderDays) {
          useReminder.getState().setNextExam(reply.reminderDays)
          const next = useReminder.getState().nextExam
          if (next) useNotifications.getState().add('تذكير الفحص الذاتي', `ميعاد فحصك الذاتي الجاي يوم ${dayLabel(next)}.`)
        }
        if (then) get().send(then)
      }, at)
      timers.push(timer)
    })
  }

  return {
    messages: [],
    chips: [],
    typing: false,
    started: false,
    convo: FRESH,
    // The first time the chat opens, Wanas says hello. "ask" is a question sent from another screen.
    start: (ask) => {
      if (get().started) {
        if (ask) get().send(ask)
        return
      }
      set({ started: true })
      deliver(welcome(context()), ask)
    },
    send: (text) => {
      const clean = text.trim()
      if (!clean || get().typing) return
      const history = get().messages
      set((s) => ({ messages: [...s.messages, { id: newId(), from: 'user', text: clean }] }))
      const c = context()
      const reply = respond(clean, c, get().convo)
      if (!reply.fallback) {
        deliver(reply)
        return
      }
      // A question the written replies don't cover: Claude answers it through the server. If the server can't,
      // the written answer is shown instead.
      set({ typing: true, chips: [] })
      askWanesAI(claudePrompt(clean, c, history))
        .then(({ reply: text }) => deliver({ messages: [{ text }], chips: reply.chips }))
        .catch(() => deliver(reply))
    },
    reset: () => {
      timers.forEach((t) => window.clearTimeout(t))
      timers = []
      set({ messages: [], chips: [], typing: false, started: false, convo: FRESH })
    },
  }
})
