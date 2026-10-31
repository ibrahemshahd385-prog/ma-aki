import { useState } from 'react'
import type { Card, Tone } from '../data/wanas'
import { Icon } from './Icon'

// Background, border and title colour for each kind of card.
const TONES: Record<Tone, { box: string; title: string }> = {
  pink: { box: 'border-brand-line bg-white', title: 'text-brand-deep' },
  green: { box: 'border-[#BFE3C8] bg-[#EEF8F0]', title: 'text-[#1E6B34]' },
  urgent: { box: 'border-[#F5B5C6] bg-[#FFF1F4]', title: 'text-[#A3123A]' },
}

function Line({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 text-sm leading-[1.7]">
      <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-brand" />
      {text}
    </p>
  )
}

// The breathing exercise: the circle grows (breathe in), stays (hold), and shrinks (breathe out), every 10 seconds.
function Breathing() {
  return (
    <div aria-hidden="true" className="relative flex h-[150px] items-center justify-center">
      <div className="size-[120px] rounded-full bg-[#FFD1E6] shadow-[0_0_0_10px_#FFE0EF] motion-safe:animate-breathe" />
      <span className="absolute text-base font-extrabold text-brand-deep motion-safe:animate-breath-in">شهيق</span>
      <span className="absolute text-base font-extrabold text-brand-deep opacity-0 motion-safe:animate-breath-hold">اكتمي نفسك</span>
      <span className="absolute text-base font-extrabold text-brand-deep opacity-0 motion-safe:animate-breath-out">زفير</span>
    </div>
  )
}

type Props = { card: Card; onGo: (to: string) => void; onSay: (text: string) => void }

// A card inside a Wanas message: a title, lines, phone numbers and buttons.
export function ChatCard({ card, onGo, onSay }: Props) {
  const tone = TONES[card.tone]
  const [copied, setCopied] = useState(false)

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={'flex flex-col gap-2.5 self-stretch rounded-[18px] border-[1.5px] p-3.5 ' + tone.box}>
      <p className={'text-[15px] leading-relaxed font-extrabold ' + tone.title}>{card.title}</p>

      {card.progress && (
        <div aria-hidden="true" className="grid grid-cols-5 gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={'h-1.5 rounded-full ' + (n <= (card.progress ?? 0) ? 'bg-brand' : 'bg-[#FFD6EA]')} />
          ))}
        </div>
      )}

      {card.lines?.map((l) => <Line key={l} text={l} />)}

      {card.sections?.map((s) => (
        <div key={s.head} className="flex flex-col gap-1.5">
          <p className="text-[12.5px] font-extrabold text-muted">{s.head}</p>
          {s.lines.map((l) => (
            <Line key={l} text={l} />
          ))}
        </div>
      ))}

      {card.breathing && <Breathing />}

      {card.numbers && card.numbers.length > 0 && (
        <div className="flex flex-col gap-2">
          {card.numbers.map((n) => (
            <a
              key={n.number}
              href={`tel:${n.number}`}
              className="flex min-h-11 items-center gap-2 rounded-[14px] border border-brand-line bg-white ps-3 pe-2"
            >
              <span className="min-w-0 flex-1 text-[13px] font-bold text-body">{n.label}</span>
              <span dir="ltr" className="text-lg font-extrabold">
                {n.number}
              </span>
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand-soft">
                <Icon name="phone" size={18} color="#B80F68" stroke={2.2} />
              </span>
            </a>
          ))}
        </div>
      )}

      {card.copy && (
        <button
          type="button"
          onClick={() => copy(card.copy ?? '')}
          className="min-h-11 self-start rounded-[14px] border-[1.5px] border-brand bg-white px-3.5 text-sm font-extrabold text-brand"
        >
          {copied ? 'اتنسخ ✓' : 'انسخي الملخص'}
        </button>
      )}

      {card.buttons && (
        <div className="flex flex-wrap gap-2">
          {card.buttons.map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={() => (b.go ? onGo(b.go) : b.say ? onSay(b.say) : undefined)}
              className="min-h-11 rounded-[14px] bg-brand px-4 text-sm font-extrabold text-white"
            >
              {b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
