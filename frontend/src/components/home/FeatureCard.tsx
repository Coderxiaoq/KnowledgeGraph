type FeatureCardProps = {
  title: string
  description: string
}

export function FeatureCard({ title, description }: FeatureCardProps) {
  return (
    <article className="rounded-3xl border border-ink-900/10 bg-white/80 p-6 shadow-[0_18px_60px_rgba(19,26,34,0.08)] backdrop-blur">
      <h3 className="font-display text-xl font-bold text-ink-900">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-ink-700">{description}</p>
    </article>
  )
}
