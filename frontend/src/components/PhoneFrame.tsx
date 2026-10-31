import type { ReactNode } from 'react'

// On a computer the app sits inside a phone-shaped frame; on a phone it fills the screen.
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh items-center justify-center sm:p-4">
      <div className="relative h-full w-full overflow-hidden bg-app text-ink sm:h-[min(844px,100%)] sm:w-[390px] sm:rounded-[40px] sm:shadow-[0_0_0_10px_#2A0F1E,0_30px_80px_rgba(184,15,104,0.28)]">
        {children}
      </div>
    </div>
  )
}