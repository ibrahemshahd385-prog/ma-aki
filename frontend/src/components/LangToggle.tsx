import { getLang, setLang } from '../lib/i18n'

// عربي / English: the app opens again in the other language. Its own label is never translated.
export function LangToggle({ short = false, className = '' }: { short?: boolean; className?: string }) {
  const english = getLang() === 'en'
  return (
    <button
      type="button"
      data-no-translate
      lang={english ? 'ar' : 'en'}
      onClick={() => setLang(english ? 'ar' : 'en')}
      aria-label={english ? 'التطبيق بالعربي' : 'Switch to English'}
      className={
        'flex min-h-11 min-w-11 items-center justify-center rounded-2xl border-[1.5px] border-brand-line bg-white px-3 text-sm font-extrabold text-brand ' +
        className
      }
    >
      {english ? (short ? 'ع' : 'عربي') : short ? 'EN' : 'English'}
    </button>
  )
}
