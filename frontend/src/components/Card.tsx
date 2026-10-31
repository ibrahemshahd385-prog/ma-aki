import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

type CardProps = { children: ReactNode; tone?: 'white' | 'green' }

// The rounded box most screens are made of.
export function Card({ children, tone = 'white' }: CardProps) {
  return (
    <section
      className={
        'flex flex-col gap-3 rounded-3xl px-5 py-[18px] shadow-[0_6px_22px_rgba(224,23,127,0.08)] ' +
        (tone === 'green' ? 'bg-[#EAF7EE]' : 'bg-white')
      }
    >
      {children}
    </section>
  )
}

type TitleProps = { icon: IconName; children: ReactNode; green?: boolean }

// A card's heading, with an icon before it.
export function CardTitle({ icon, children, green = false }: TitleProps) {
  const color = green ? '#1E6B34' : '#E0177F'
  return (
    <h2 className="flex items-center gap-2 text-[19px] font-extrabold" style={{ color }}>
      <Icon name={icon} color={color} stroke={2.2} />
      {children}
    </h2>
  )
}