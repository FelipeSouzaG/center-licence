import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "good" | "warn" | "danger";

export function Badge({ label, tone = "neutral" }: { label: string; tone?: BadgeTone }) {
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

export function Card({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {icon ? <div className="panel-icon">{icon}</div> : null}
      </header>
      <div>{children}</div>
    </section>
  );
}
