import type { ComponentProps } from 'react'

type Variant = 'primary' | 'soft' | 'outline' | 'small' | 'solid'

const VARIANTS: Record<Variant, string> = {
  primary: 'min-h-14 rounded-[18px] bg-grad px-4 text-lg font-extrabold text-white shadow-[0_10px_24px_rgba(224,23,127,0.28)]',
  soft: 'min-h-12 rounded-2xl border-[1.5px] border-brand-line bg-white px-3.5 text-[15px] font-bold text-ink',
  outline: 'min-h-[52px] rounded-2xl border-[1.5px] border-brand bg-white px-3.5 text-[15px] font-extrabold text-brand',
  small: 'min-h-11 rounded-[14px] border-[1.5px] border-brand bg-white px-3.5 text-sm font-extrabold text-brand',
  solid: 'min-h-11 rounded-[14px] bg-brand px-4 text-sm font-extrabold text-white',
}

type Props = ComponentProps<'button'> & { variant?: Variant }

// One button for the whole app, in five looks.
export function Button({ variant = 'primary', type = 'button', className = '', ...rest }: Props) {
  return (
    <button
      type={type}
      className={`flex items-center justify-center gap-2 disabled:opacity-45 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  )
}