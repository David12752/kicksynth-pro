import { ReactNode } from 'react'

type ParameterSectionProps = {
  title: string
  children: ReactNode
}

export default function ParameterSection({ title, children }: ParameterSectionProps) {
  return (
    <section className="param-section">
      <div className="param-section-title">{title}</div>
      <div className="param-section-grid">{children}</div>
    </section>
  )
}
