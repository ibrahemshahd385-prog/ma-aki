type Props = { title: string; step: number }

// A temporary card until each screen is built.
export function Placeholder({ title, step }: Props) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-[0_6px_22px_rgba(224,23,127,0.08)]">
      <h1 className="text-xl font-extrabold text-brand">{title}</h1>
      <p className="mt-2 text-body">الشاشة دي هنبنيها في الخطوة {step}.</p>
    </section>
  )
}