import { ClipboardList, Copy, MessageSquare, PlusCircle, RefreshCw, Search, Sparkles, Target } from "lucide-react";
import type React from "react";
import { Badge, Card, leadCadenceLabels, leadConsentLabels, leadSourceLabels, leadStatusLabels } from "./tabShared";

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
  cadence: LeadCadence;
  is_active: boolean;
  notes: string | null;
};

type LeadOpportunity = {
  id: string;
  source: LeadSource;
  channel_url: string | null;
  author_name: string | null;
  contact_name: string | null;
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
  handleCreateLeadCampaign: (event: React.FormEvent) => void;
  handleLeadCampaignSelection: (campaignId: string) => void;
  handleCreateLeadOpportunity: (event: React.FormEvent) => void;
  handleCopyLeadMessage: (message: string | null) => void;
  handleRegenerateLead: (leadId: string) => void;
  handleUpdateLeadStatus: (leadId: string, status: LeadStatus) => void;
  toneFromLeadStatus: (status: LeadStatus) => "good" | "warn" | "danger" | "neutral";
  toneFromLeadTemperature: (temperature: LeadTemperature) => "good" | "warn" | "danger" | "neutral";
};

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
          <span className="lead-eyebrow">Captação orgânica assistida</span>
          <h2>Encontre pessoas dizendo que precisam de um sistema.</h2>
          <p>
            A regra é simples: monitore frases de intenção, registre o achado, deixe o agente priorizar e aborde com uma mensagem humana.
          </p>
        </div>
        <div className="lead-hero-steps" aria-label="Fluxo de uso">
          <span>1. Configurar alertas</span>
          <span>2. Capturar frase real</span>
          <span>3. Copiar abordagem</span>
          <span>4. Levar para diagnóstico</span>
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
        <Card title="Campanhas de busca" subtitle="Termos que pessoas usam quando estão procurando software" icon={<Target size={16} />}>
          <div className="lead-section-actions">
            <button className="btn btn-secondary" disabled={loading} onClick={handleSeedLeadCampaigns} type="button">
              <Sparkles size={15} /> Criar termos base
            </button>
          </div>

          <form className="lead-form-grid" onSubmit={handleCreateLeadCampaign}>
            <label>
              Nome
              <input
                onChange={(event) => setLeadCampaignForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Ex: Procuro sistema"
                value={leadCampaignForm.name}
              />
            </label>
            <label>
              Contexto opcional
              <input
                onChange={(event) => setLeadCampaignForm((prev) => ({ ...prev, niche: event.target.value }))}
                placeholder="Qualquer negócio"
                value={leadCampaignForm.niche}
              />
            </label>
            <label>
              Fonte
              <select onChange={(event) => setLeadCampaignForm((prev) => ({ ...prev, source: event.target.value as LeadSource }))} value={leadCampaignForm.source}>
                {leadSourceOptions.map((source) => (
                  <option key={source} value={source}>
                    {leadSourceLabels[source]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cadência
              <select onChange={(event) => setLeadCampaignForm((prev) => ({ ...prev, cadence: event.target.value as LeadCadence }))} value={leadCampaignForm.cadence}>
                {leadCadenceOptions.map((cadence) => (
                  <option key={cadence} value={cadence}>
                    {leadCadenceLabels[cadence]}
                  </option>
                ))}
              </select>
            </label>
            <label className="lead-form-wide">
              Termo de busca
              <input
                onChange={(event) => setLeadCampaignForm((prev) => ({ ...prev, search_query: event.target.value }))}
                placeholder={'"procuro sistema" OR "preciso de sistema"'}
                value={leadCampaignForm.search_query}
              />
            </label>
            <label className="lead-form-wide">
              Observações
              <input
                onChange={(event) => setLeadCampaignForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Onde usar, restrições do canal, tipo de lead esperado"
                value={leadCampaignForm.notes}
              />
            </label>
            <div className="lead-form-actions">
              <button className="btn btn-primary" disabled={loading} type="submit">
                <PlusCircle size={15} /> Salvar campanha
              </button>
            </div>
          </form>

          <div className="lead-campaign-list">
            {leadCampaigns.map((campaign) => (
              <article className="lead-campaign-item" key={campaign.id}>
                <div>
                  <strong>{campaign.name}</strong>
                  <span>
                    {campaign.niche || "Qualquer negócio"} · {leadSourceLabels[campaign.source]} · {leadCadenceLabels[campaign.cadence]}
                  </span>
                  <code>{campaign.search_query}</code>
                </div>
                <Badge label={campaign.is_active ? "ATIVA" : "PAUSADA"} tone={campaign.is_active ? "good" : "neutral"} />
              </article>
            ))}
            {leadCampaigns.length === 0 ? <p className="muted">Crie os termos base e copie para Google Alerts/Talkwalker/F5Bot.</p> : null}
          </div>
        </Card>

        <Card title="Capturar oportunidade" subtitle="Cole a frase real da pessoa. O agente cuida do score." icon={<ClipboardList size={16} />}>
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
              <div className="lead-message-box">{lead.suggested_message || "Sem abordagem gerada."}</div>
              <div className="row-actions">
                <button className="btn btn-secondary" onClick={() => handleCopyLeadMessage(lead.suggested_message)} type="button">
                  <Copy size={15} /> Copiar
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
