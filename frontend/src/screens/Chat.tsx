import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ChatCard } from '../components/ChatCard'
import { Icon, Ribbon } from '../components/Icon'
import { useChat, type ChatMessage } from '../store/chat'

function Avatar() {
  return (
    <span aria-hidden="true" className="mt-0.5 flex size-[30px] shrink-0 items-center justify-center rounded-full bg-brand">
      <Ribbon width={12} height={15} stroke={22} />
    </span>
  )
}

// An Arabic voice on this device, if it has one (most phones and computers do). Without one, no "اسمعي" button.
function useArabicVoice() {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null)
  useEffect(() => {
    const ss = window.speechSynthesis
    if (!ss || typeof window.SpeechSynthesisUtterance !== 'function') return
    const pick = () => {
      const arabic = ss.getVoices().filter((v) => /^ar/i.test(v.lang))
      if (arabic.length) setVoice(arabic.find((v) => /EG/i.test(v.lang)) ?? arabic[0])
    }
    pick()
    ss.addEventListener('voiceschanged', pick)
    return () => ss.removeEventListener('voiceschanged', pick)
  }, [])
  return voice
}

// Reads a message out loud (the text and its card). Pressing again while it speaks stops it.
function speak(voice: SpeechSynthesisVoice, m: ChatMessage) {
  const ss = window.speechSynthesis
  if (ss.speaking) {
    ss.cancel()
    return
  }
  const c = m.card
  const parts = [m.text, c?.title, ...(c?.lines ?? []), ...(c?.sections ?? []).flatMap((s) => [s.head, ...s.lines])]
  const u = new SpeechSynthesisUtterance(parts.filter(Boolean).join('. '))
  u.lang = voice.lang
  u.voice = voice
  u.rate = 0.95
  ss.speak(u)
}

type BubbleProps = { message: ChatMessage; voice: SpeechSynthesisVoice | null; onGo: (to: string) => void; onSay: (text: string) => void }

function Bubble({ message, voice, onGo, onSay }: BubbleProps) {
  if (message.from === 'user') {
    return (
      <div className="max-w-[80%] self-end rounded-[18px] rounded-tl-md bg-brand px-3.5 py-2.5 text-[15px] leading-[1.7] whitespace-pre-line text-white">
        {message.text}
      </div>
    )
  }
  return (
    <div className="flex w-[92%] items-start gap-2 self-start">
      <Avatar />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
        {message.text && (
          <div className="rounded-[18px] rounded-tr-md bg-white px-3.5 py-2.5 text-[15px] leading-[1.75] break-words whitespace-pre-line shadow-[0_2px_10px_rgba(224,23,127,0.06)]">
            {message.text}
          </div>
        )}
        {message.card && <ChatCard card={message.card} onGo={onGo} onSay={onSay} />}
        {voice && (
          <button
            type="button"
            aria-label="اسمعي الرسالة بصوت"
            onClick={() => speak(voice, message)}
            className="inline-flex min-h-11 items-center gap-1.5 px-2 text-[12.5px] font-bold text-brand-deep"
          >
            <Icon name="speaker" size={16} color="#B80F68" />
            اسمعي
          </button>
        )}
      </div>
    </div>
  )
}

// Three dots that bounce while Wanas is "writing".
function Typing() {
  return (
    <div className="flex items-center gap-2 self-start">
      <Avatar />
      <div role="status" aria-label="ونس بتكتب" className="flex gap-1.5 rounded-[18px] rounded-tr-md bg-white px-4 py-3.5">
        {[0, 150, 300].map((delay) => (
          <span key={delay} className="size-2 rounded-full bg-brand motion-safe:animate-dot" style={{ animationDelay: `${delay}ms` }} />
        ))}
      </div>
    </div>
  )
}

export function Chat() {
  const navigate = useNavigate()
  const location = useLocation()
  const ask = (location.state as { ask?: string } | null)?.ask
  const { messages, chips, typing, start, send } = useChat()
  const [draft, setDraft] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const voice = useArabicVoice()

  // Say hello the first time; if another screen sent a question, ask it. Then forget it, so a refresh doesn't ask again.
  useEffect(() => {
    start(ask)
    if (ask) navigate('/chat', { replace: true, state: null })
  }, [ask, start, navigate])

  // Keep the newest message in view.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, typing])

  function back() {
    window.speechSynthesis?.cancel()
    if (location.key === 'default') navigate('/home')
    else navigate(-1)
  }

  function submit() {
    if (!draft.trim() || typing) return
    send(draft)
    setDraft('')
  }

  return (
    <div className="flex h-full flex-col bg-app">
      <header className="flex shrink-0 items-center gap-2.5 border-b border-[#FFD6EA] bg-white px-4 pt-[22px] pb-2.5">
        <button type="button" aria-label="رجوع" onClick={back} className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-app">
          <Icon name="prev" color="#3A1027" stroke={2.4} />
        </button>
        <span className="relative flex size-[46px] shrink-0 items-center justify-center rounded-full bg-grad">
          <Ribbon />
          <span aria-hidden="true" className="absolute bottom-px left-px size-3 rounded-full border-2 border-white bg-[#2EAD5B]" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] leading-tight font-extrabold">ونس</h1>
          <p className="text-xs font-bold text-muted">متاحة · ردود جاهزة</p>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3">
        <p className="self-center rounded-[10px] bg-white px-2.5 py-1 text-center text-[11.5px] font-semibold text-muted">
          ونس مساعدة توعوية، ومش بديل عن الطبيب
        </p>
        {messages.map((m) => (
          <Bubble key={m.id} message={m} voice={voice} onGo={(to) => navigate(to)} onSay={send} />
        ))}
        {typing && <Typing />}
        <div ref={end} />
      </div>

      <div className="flex shrink-0 flex-col gap-2.5 border-t border-[#FFD6EA] bg-white px-4 pt-2.5 pb-4">
        {chips.length > 0 && !typing && (
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chips.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => send(c)}
                className="min-h-11 shrink-0 rounded-full border-[1.5px] border-brand-line bg-app px-3.5 text-[13px] font-bold whitespace-nowrap text-brand-deep"
              >
                {c}
              </button>
            ))}
          </div>
        )}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <label htmlFor="chat-input" className="sr-only">
            رسالتك لونس
          </label>
          <input
            id="chat-input"
            type="text"
            autoComplete="off"
            placeholder="اكتبي سؤالك لونس…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-12 min-w-0 flex-1 rounded-full border-[1.5px] border-brand-line bg-app px-4 text-[15px] outline-brand focus:outline-2 focus:outline-offset-1"
          />
          <button
            type="submit"
            aria-label="إرسال"
            disabled={typing || !draft.trim()}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand disabled:opacity-45"
          >
            <Icon name="send" color="#FFFFFF" stroke={2.4} />
          </button>
        </form>
      </div>
    </div>
  )
}
