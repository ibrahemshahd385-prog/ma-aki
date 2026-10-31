import { useToast } from '../store/toast'

// The short message at the bottom of the phone. The box is always there (empty and hidden when there is
// nothing to say), so screen readers read each new message.
export function Toast() {
  const text = useToast((s) => s.text)
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        text
          ? 'absolute inset-x-4 bottom-[92px] z-20 rounded-[14px] bg-ink px-3.5 py-3 text-center text-sm font-bold text-white shadow-[0_10px_30px_rgba(58,16,39,0.3)]'
          : 'sr-only'
      }
    >
      {text}
    </div>
  )
}
