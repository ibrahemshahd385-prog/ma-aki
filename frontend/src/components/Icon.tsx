import type { ReactNode } from 'react'

export type IconName =
  | 'home'
  | 'assess'
  | 'doctor'
  | 'tests'
  | 'bell'
  | 'chat'
  | 'user'
  | 'calendar'
  | 'compass'
  | 'check'
  | 'next'
  | 'prev'
  | 'heart'
  | 'link'
  | 'phone'
  | 'upload'
  | 'send'
  | 'clock'
  | 'pulse'
  | 'speaker'

const PATHS: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V20h5v-6h4v6h5V9.5" />
    </>
  ),
  assess: (
    <>
      <rect x="8" y="2.5" width="8" height="4" rx="1" />
      <path d="M16 4.5h2a2 2 0 0 1 2 2V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h2" />
      <path d="M9 14l2 2 4-4" />
    </>
  ),
  doctor: (
    <>
      <path d="M6 3v6a4 4 0 0 0 8 0V3" />
      <path d="M10 13v3a5 5 0 0 0 10 0v-2" />
      <circle cx="20" cy="12" r="2" />
    </>
  ),
  tests: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M12 17v-6" />
      <path d="M9.5 13.5L12 11l2.5 2.5" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </>
  ),
  chat: <path d="M21 11.5a8.4 8.4 0 0 1-12.2 7.5L3 21l2-5.4A8.4 8.4 0 1 1 21 11.5z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
      <path d="M9 14.5l2 2 4-4" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  check: <path d="M5 12l5 5 9-10" />,
  // The app reads right to left, so "next" points left and "prev" points right.
  next: <path d="M15 6l-6 6 6 6" />,
  prev: <path d="M9 6l6 6-6 6" />,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />,
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </>
  ),
  phone: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  ),
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M5 20h14" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  // A heartbeat line: the follow-up during treatment.
  pulse: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  speaker: (
    <>
      <path d="M11 5L6 9H3v6h3l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </>
  ),
  // Points left, the way text goes in Arabic.
  send: (
    <>
      <path d="M20 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </>
  ),
}

type IconProps = { name: IconName; size?: number; color?: string; stroke?: number }

export function Icon({ name, size = 22, color = 'currentColor', stroke = 2 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-flip={name === 'next' || name === 'prev' || name === 'send' ? '' : undefined}
    >
      {PATHS[name]}
    </svg>
  )
}

type RibbonProps = { width?: number; height?: number; stroke?: number }

export function Ribbon({ width = 18, height = 22, stroke = 20 }: RibbonProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 120 150" aria-hidden="true">
      <path d="M60 14 C36 14 28 40 38 60 L84 138" fill="none" stroke="#FFFFFF" strokeWidth={stroke} strokeLinecap="round" />
      <path d="M60 14 C84 14 92 40 82 60 L36 138" fill="none" stroke="#FFD1E6" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  )
}
