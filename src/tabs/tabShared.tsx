import React from "react";

export type BadgeTone = "neutral" | "good" | "warn" | "danger";

export function Badge({ label, tone = "neutral" }: { label: string; tone?: BadgeTone }) {
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

export function Card({
  title,
  subtitle,
  icon,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`.trim()}>
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

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

export const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString("pt-BR") : "-");

export const billingModeLabels: Record<string, string> = {
  ALWAYS_FREE: "Sempre gratuito",
  FREE: "Gratuito (30+3)",
  NORMAL: "Normal (cobrança mensal)",
};

export const leadSourceLabels: Record<string, string> = {
  GOOGLE_ALERTS: "Google Alerts",
  TALKWALKER: "Talkwalker",
  F5BOT: "F5Bot",
  FACEBOOK_PUBLIC: "Facebook público",
  YOUTUBE: "YouTube",
  INSTAGRAM_TIKTOK: "Instagram/TikTok",
  MANUAL: "Manual",
  OTHER: "Outro",
};

export const leadCadenceLabels: Record<string, string> = {
  REALTIME: "Quando acontecer",
  DAILY: "Diário",
  WEEKLY: "Semanal",
  MANUAL: "Manual",
};

export const leadStatusLabels: Record<string, string> = {
  CAPTURED: "Capturado",
  OUTREACH_READY: "Abordagem pronta",
  CONTACTED: "Contatado",
  REPLIED: "Respondeu",
  DIAGNOSIS: "Diagnóstico",
  TRIAL: "Trial",
  RENEWED: "Renovou",
  LOST: "Perdido",
};

export const leadConsentLabels: Record<string, string> = {
  UNKNOWN: "Desconhecido",
  INBOUND: "Inbound",
  OPT_IN: "Opt-in",
  PUBLIC_REPLY_ONLY: "Só resposta pública",
  NOT_ALLOWED: "Não permitido",
};
