import { Bot, ClipboardList, Copy, MessageSquare, PlusCircle, RefreshCw, Search, Sparkles, Target } from "lucide-react";
import type React from "react";
import { Badge, Card, formatDate, leadCadenceLabels, leadConsentLabels, leadSourceLabels, leadStatusLabels } from "./tabShared";

type LeadSource = "GOOGLE_ALERTS" | "TALKWALKER" | "F5BOT" | "FACEBOOK_PUBLIC" | "YOUTUBE" | "INSTAGRAM_TIKTOK" | "MANUAL" | "OTHER";
type LeadCadence = "REALTIME" | "DAILY" | "WEEKLY" | "MANUAL";
type LeadTemperature = "HOT" | "WARM" | "COLD";
type LeadStatus = "CAPTURED" | "OUTREACH_READY" | "CONTACTED" | "REPLIED" | "DIAGNOSIS" | "TRIAL" | "RENEWED" | "LOST";
type LeadConsentStatus = "UNKNOWN" | "INBOUND" | "OPT_IN" | "PUBLIC_REPLY_ONLY" | "NOT_ALLOWED";

type LeadCampaign = {
  id: string;
  name: string;
  niche: string;
  source: LeadSource;
  search_query: string;
  feed_url: string | null;
  cadence: LeadCadence;
  is_active: boolean;
  last_checked_at: string | null;
  last_scan_status: string | null;
  last_scan_message: string | null;
  notes: string | null;
};

type LeadOpportunity = {
  id: string;
  source: LeadSource;
  channel_url: string | null;
  author_name: string | null;
  contact_name: string | null;
  contact_handle: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  business_name: string | null;
  niche: string;
  pain_phrase: string;
  intent_temperature: LeadTemperature;
  score: number;
  status: LeadStatus;
  consent_status: LeadConsentStatus;
  suggested_message: string | null;
  next_action: string | null;
};

type LeadCampaignForm = {
  name: string;
  niche: string;
  source: LeadSource;
  search_query: string;
  feed_url: string;
  cadence: LeadCadence;
  notes: string;
};

type LeadForm = {
  campaign_id: string;
  source: LeadSource;
  channel_url: string;
  author_name: string;
  contact_name: string;
  contact_handle: string;
  contact_phone: string;
  contact_email: string;
  business_name: string;
  niche: string;
  pain_phrase: string;
  pain_summary: string;
  consent_status: LeadConsentStatus;
  demand_notes: string;
};

type LeadStats = {
  total: number;
  hot: number;
  ready: number;
  trial: number;
  renewed: number;
  averageScore: number;
  activeCampaigns: number;
};

type Props = {
  loading: boolean;
  leadStats: LeadStats;
  leadCampaigns: LeadCampaign[];
  leadOpportunities: LeadOpportunity[];
  leadCampaignForm: LeadCampaignForm;
  leadForm: LeadForm;
  leadStatusFilter: LeadStatus | "";
  leadSourceOptions: LeadSource[];
  leadCadenceOptions: LeadCadence[];
  leadStatusOptions: LeadStatus[];
  leadConsentOptions: LeadConsentStatus[];
  setLeadCampaignForm: React.Dispatch<React.SetStateAction<LeadCampaignForm>>;
  setLeadForm: React.Dispatch<React.SetStateAction<LeadForm>>;
  setLeadStatusFilter: (value: LeadStatus | "") => void;
  handleSeedLeadCampaigns: () => void;
  handleRunLeadScan: () => void;
  handleCreateLeadCampaign: (event: React.FormEvent) => void;
  handleLeadCampaignSelection: (campaignId: string) => void;
  handleCreateLeadOpportunity: (event: React.FormEvent) => void;
  handleCopyLeadMessage: (message: string | null) => void;
  handleRegenerateLead: (leadId: string) => void;
  handleUpdateLeadStatus: (leadId: string, status: LeadStatus) => void;
  toneFromLeadStatus: (status: LeadStatus) => "good" | "warn" | "danger" | "neutral";
  toneFromLeadTemperature: (temperature: LeadTemperature) => "good" | "warn" | "danger" | "neutral";
};

const intentTerms = [
  '"procuro sistema" OR "preciso de sistema"',
  '"preciso sair da planilha"',
  '"sistema para controlar pedidos"',
  '"alguém indica sistema"',
  '"software para controlar"',
  '"quero automatizar" "empresa"',
];

const connectorCards = [
  {
    title: "Alertas e web aberta",
    status: "Pronto para RSS/API",
    detail: "Google Alerts, Talkwalker, F5Bot e fontes com feed entram no agente automatico.",
    tone: "good" as const,
  },
  {
    title: "Redes e comunidades",
    status: "Precisa conector autorizado",
    detail: "Facebook, Instagram, TikTok e grupos entram por API, permissao ou extensao assistida.",
    tone: "warn" as const,
  },
  {
    title: "WhatsApp Business",
    status: "Somente inbound/opt-in",
    detail: "Contato automatico deve usar conversa iniciada pelo cliente, opt-in ou template aprovado.",
    tone: "neutral" as const,
  },
];

export function LeadHunterTab({
  loading,
  leadStats,
  leadCampaigns,
  leadOpportunities,
  leadCampaignForm,
  leadForm,
  leadStatusFilter,
  leadSourceOptions,
  leadCadenceOptions,
  leadStatusOptions,
  leadConsentOptions,
  setLeadCampaignForm,
  setLeadForm,
  setLeadStatusFilter,
  handleSeedLeadCampaigns,
  handleRunLeadScan,
  handleCreateLeadCampaign,
  handleLeadCampaignSelection,
  handleCreateLeadOpportunity,
  handleCopyLeadMessage,
  handleRegenerateLead,
  handleUpdateLeadStatus,
  toneFromLeadStatus,
  toneFromLeadTemperature,
}: Props) {
  return (
    <section className="lead-command-center">
      <section className="lead-hero-panel">
        <div>
          <span className="lead-eyebrow">Agente caçador de leads</span>
          <h2>Inicie a busca por pessoas que precisam de um sistema.</h2>
          <p>
            O agente usa termos de intenção, consulta fontes conectadas, cria oportunidades e prioriza contatos para abordagem permitida.
          </p>
          <div className="lead-agent-actions">
            <button className="btn btn-primary" disabled={loading} onClick={handleRunLeadScan} type="button">
              <Bot size={16} /> Iniciar agente
            </button>
            <button className="btn btn-secondary" disabled={loading} onClick={handleSeedLeadCampaigns} type="button">
              <Sparkles size={15} /> Preparar termos
            </button>
          </div>
        </div>
        <div className="lead-hero-steps" aria-label="Fluxo de uso">
          <span>1. Iniciar agente</span>
          <span>2. Buscar sinais reais</span>
          <span>3. Capturar contato</span>
          <span>4. Abordar no canal permitido</span>
        </div>
      </section>

      <Card title="Radar de intenção" subtitle="Mede procura explícita por sistema, não nicho" icon={<Search size={16} />}>
        <div className="lead-summary-row lead-summary-row-compact">
          <div>
            <span>Alertas ativos</span>
            <strong>{leadStats.activeCampaigns}</strong>
          </div>
          <div>
            <span>Leads</span>
            <strong>{leadStats.total}</strong>
          </div>
          <div>
            <span>Alta intenção</span>
            <strong>{leadStats.hot}</strong>
          </div>
          <div>
            <span>Prontos</span>
            <strong>{leadStats.ready}</strong>
          </div>
          <div>
            <span>Trial</span>
            <strong>{leadStats.trial}</strong>
          </div>
          <div>
            <span>Renovou</span>
            <strong>{leadStats.renewed}</strong>
          </div>
          <div>
            <span>Score médio</span>
            <strong>{leadStats.averageScore}</strong>
          </div>
        </div>
      </Card>

      <section className="lead-split">
        <Card title="Entrada do agente" subtitle="Termos e fontes que alimentam a busca automatica" icon={<Target size={16} />}>
          <div className="lead-term-grid">
            {intentTerms.map((term) => (
              <code className="lead-term-chip" key={term}>
                {term}
              </code>
            ))}
          </div>

          <div className="lead-connector-grid">
            {connectorCards.map((connector) => (
              <article className="lead-connector-card" key={connector.title}>
                <div>
                  <strong>{connector.title}</strong>
                  <span>{connector.detail}</span>
                </div>
                <Badge label={connector.status} tone={connector.tone} />
              </article>
            ))}
          </div>

          <form className="lead-form-grid lead-connector-form" onSubmit={handleCreateLeadCampaign}>
            <label>
              Fonte conectada
              <select onChange={(event) => setLeadCampaignForm((prev) => ({ ...prev, source: event.target.value as LeadSource }))} value={leadCampaignForm.source}>
                {leadSourceOptions.map((source) => (
                  <option key={source} value={source}>
                    {leadSourceLabels[source]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Termo
              <input
                onChange={(event) => setLeadCampaignForm((prev) => ({ ...prev, search_query: event.target.value }))}
                placeholder={'"procuro sistema" OR "preciso de sistema"'}
                value={leadCampaignForm.search_query}
              />
            </label>
            <label className="lead-form-wide">
              URL de feed/API
              <input
                onChange={(event) => setLeadCampaignForm((prev) => ({ ...prev, feed_url: event.target.value }))}
                placeholder="RSS, Atom, webhook ou endpoint autorizado"
                value={leadCampaignForm.feed_url}
              />
            </label>
            <label className="lead-form-wide">
              Observações do conector
              <input
                onChange={(event) => setLeadCampaignForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Comunidade, permissao, regra de contato ou origem da autorizacao"
                value={leadCampaignForm.notes}
              />
            </label>
            <div className="lead-form-actions">
              <button className="btn btn-secondary" disabled={loading} type="submit">
                <PlusCircle size={15} /> Conectar fonte
              </button>
            </div>
          </form>

          <div className="lead-campaign-list">
            {leadCampaigns.map((campaign) => (
              <article className="lead-campaign-item" key={campaign.id}>
                <div>
                  <strong>{campaign.name}</strong>
                  <span>
                    {leadSourceLabels[campaign.source]} · {leadCadenceLabels[campaign.cadence]}
                  </span>
                  <code>{campaign.search_query}</code>
                  {campaign.feed_url ? <span className="lead-feed-url">Fonte: {campaign.feed_url}</span> : null}
                  <span className="lead-scan-status">
                    Última busca: {formatDate(campaign.last_checked_at)}
                    {campaign.last_scan_message ? ` · ${campaign.last_scan_message}` : ""}
                  </span>
                </div>
                <Badge
                  label={campaign.feed_url ? (campaign.last_scan_status === "error" ? "ERRO" : "CONECTADA") : campaign.is_active ? "AGUARDANDO FONTE" : "PAUSADA"}
                  tone={campaign.feed_url ? (campaign.last_scan_status === "error" ? "danger" : "good") : campaign.is_active ? "warn" : "neutral"}
                />
              </article>
            ))}
            {leadCampaigns.length === 0 ? <p className="muted">Clique em Iniciar agente para preparar os termos base.</p> : null}
          </div>
        </Card>

        <Card title="Entrada assistida" subtitle="Use quando a fonte ainda nao tem conector automatico" icon={<ClipboardList size={16} />}>
          <form className="lead-form-grid" onSubmit={handleCreateLeadOpportunity}>
            <label>
              Campanha
              <select onChange={(event) => handleLeadCampaignSelection(event.target.value)} value={leadForm.campaign_id}>
                <option value="">Sem campanha</option>
                {leadCampaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fonte
              <select onChange={(event) => setLeadForm((prev) => ({ ...prev, source: event.target.value as LeadSource }))} value={leadForm.source}>
                {leadSourceOptions.map((source) => (
                  <option key={source} value={source}>
                    {leadSourceLabels[source]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Contexto opcional
              <input
                onChange={(event) => setLeadForm((prev) => ({ ...prev, niche: event.target.value }))}
                placeholder="Ex: loja, clínica, buffet"
                value={leadForm.niche}
              />
            </label>
            <label>
              Permissão de contato
              <select onChange={(event) => setLeadForm((prev) => ({ ...prev, consent_status: event.target.value as LeadConsentStatus }))} value={leadForm.consent_status}>
                {leadConsentOptions.map((consent) => (
                  <option key={consent} value={consent}>
                    {leadConsentLabels[consent]}
                  </option>
                ))}
              </select>
            </label>
            <label className="lead-form-wide">
              Frase real com intenção de sistema
              <textarea
                onChange={(event) => setLeadForm((prev) => ({ ...prev, pain_phrase: event.target.value }))}
                placeholder='Ex: "Alguém indica um sistema simples para controlar pedidos pelo WhatsApp?"'
                required
                value={leadForm.pain_phrase}
              />
            </label>
            <label className="lead-form-wide">
              Resumo para diagnóstico
              <input
                onChange={(event) => setLeadForm((prev) => ({ ...prev, pain_summary: event.target.value }))}
                placeholder="Ex: quer sistema simples, está em planilha, precisa testar rápido"
                value={leadForm.pain_summary}
              />
            </label>
            <label>
              Nome/autor
              <input onChange={(event) => setLeadForm((prev) => ({ ...prev, author_name: event.target.value }))} value={leadForm.author_name} />
            </label>
            <label>
              Empresa
              <input onChange={(event) => setLeadForm((prev) => ({ ...prev, business_name: event.target.value }))} value={leadForm.business_name} />
            </label>
            <label>
              Handle/contato
              <input onChange={(event) => setLeadForm((prev) => ({ ...prev, contact_handle: event.target.value }))} value={leadForm.contact_handle} />
            </label>
            <label>
              Telefone
              <input inputMode="tel" onChange={(event) => setLeadForm((prev) => ({ ...prev, contact_phone: event.target.value }))} value={leadForm.contact_phone} />
            </label>
            <label className="lead-form-wide">
              Link do achado
              <input onChange={(event) => setLeadForm((prev) => ({ ...prev, channel_url: event.target.value }))} placeholder="URL pública do post, alerta ou conversa" value={leadForm.channel_url} />
            </label>
            <label className="lead-form-wide">
              Notas internas
              <input onChange={(event) => setLeadForm((prev) => ({ ...prev, demand_notes: event.target.value }))} placeholder="Risco, ideia de trial, observações do atendimento" value={leadForm.demand_notes} />
            </label>
            <div className="lead-form-actions">
              <button className="btn btn-primary" disabled={loading} type="submit">
                <MessageSquare size={15} /> Capturar oportunidade
              </button>
            </div>
          </form>
        </Card>
      </section>

      <Card title="Inbox de oportunidades" subtitle="Priorize pessoas que já disseram que precisam de sistema" icon={<MessageSquare size={16} />} className="lead-inbox-panel">
        <div className="lead-inbox-toolbar">
          <label>
            Status
            <select onChange={(event) => setLeadStatusFilter(event.target.value as LeadStatus | "")} value={leadStatusFilter}>
              <option value="">Todos</option>
              {leadStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {leadStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="lead-opportunity-grid">
          {leadOpportunities.map((lead) => (
            <article className="lead-opportunity-card" key={lead.id}>
              <header>
                <div>
                  <strong>{lead.business_name || lead.contact_name || lead.author_name || "Lead sem nome"}</strong>
                  <span>{lead.niche || "Qualquer negócio"} · {leadSourceLabels[lead.source]}</span>
                </div>
                <div className="lead-score-badge">
                  <strong>{lead.score}</strong>
                  <Badge label={lead.intent_temperature} tone={toneFromLeadTemperature(lead.intent_temperature)} />
                </div>
              </header>
              <p>{lead.pain_phrase}</p>
              {lead.next_action ? <span className="lead-next-action">{lead.next_action}</span> : null}
              <div className="lead-card-meta">
                <Badge label={leadStatusLabels[lead.status]} tone={toneFromLeadStatus(lead.status)} />
                <span>{leadConsentLabels[lead.consent_status]}</span>
                {lead.channel_url ? (
                  <a href={lead.channel_url} rel="noreferrer" target="_blank">
                    origem
                  </a>
                ) : null}
              </div>
              <div className="lead-contact-grid">
                <span>{lead.contact_phone || "Telefone nao capturado"}</span>
                <span>{lead.contact_email || "Email nao capturado"}</span>
                <span>{lead.contact_handle || "Handle nao capturado"}</span>
              </div>
              <div className="lead-message-box">{lead.suggested_message || "Aguardando conector de abordagem."}</div>
              <div className="row-actions">
                <button className="btn btn-secondary" onClick={() => handleCopyLeadMessage(lead.suggested_message)} type="button">
                  <Copy size={15} /> Copiar abordagem
                </button>
                <button className="btn btn-ghost" onClick={() => handleRegenerateLead(lead.id)} type="button">
                  <RefreshCw size={15} /> Recalcular
                </button>
              </div>
              <div className="lead-status-actions">
                {leadStatusOptions.map((status) => (
                  <button className={lead.status === status ? "lead-status-chip active" : "lead-status-chip"} key={status} onClick={() => handleUpdateLeadStatus(lead.id, status)} type="button">
                    {leadStatusLabels[status]}
                  </button>
                ))}
              </div>
            </article>
          ))}
          {leadOpportunities.length === 0 ? <p className="muted">Nenhuma oportunidade nesse filtro.</p> : null}
        </div>
      </Card>
    </section>
  );
}
