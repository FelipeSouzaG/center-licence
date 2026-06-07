import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Archive,
  CircleHelp,
  Clipboard,
  ExternalLink,
  Filter,
  History,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Search,
  Target,
  UserRound,
  X,
} from "lucide-react";
import GooglePlacesUsagePanel from "../components/GooglePlacesUsagePanel";
import { api, ApiError } from "../lib/api";
import {
  prospectingModeDescriptions,
  prospectingModeLabels,
  type GooglePlacesUsage,
  type ProspectingMode,
  type StoredProspectingMode,
} from "../types/leads";

const LEAD_STATUSES = [
  "NOVO_LEAD",
  "ABORDAGEM_MANUAL_PENDENTE",
  "ABORDAGEM_MANUAL_ENVIADA",
  "AGUARDANDO_RESPOSTA",
  "RESPONDEU",
  "BOT_EM_ATENDIMENTO",
  "APRESENTACAO_ACEITA",
  "RECUSOU_APRESENTACAO",
  "VIDEO_ENVIADO",
  "TESTE_OFERTADO",
  "TESTE_SOLICITADO",
  "TESTE_RECUSADO",
  "TRANSFERIDO_HUMANO",
  "NAO_PERTURBAR",
  "ARQUIVADO",
] as const;

type LeadStatus = (typeof LEAD_STATUSES)[number];
type ToastTone = "success" | "error" | "info";

type Lead = {
  id: string;
  nome: string;
  segmento: string;
  cidade: string;
  endereco: string | null;
  telefone: string | null;
  telefone_normalizado: string | null;
  website: string | null;
  google_maps_uri: string | null;
  google_place_id: string;
  rating: number | null;
  total_avaliacoes: number;
  fonte: string;
  score: number;
  opportunity_score: number;
  contact_score: number;
  oportunidade_detectada: string;
  mensagem_sugerida: string;
  prospecting_mode: StoredProspectingMode;
  google_attributions: Array<{
    provider: string;
    providerUri: string | null;
  }>;
  google_data_expires_at: string;
  status: LeadStatus;
  bot_stage: string;
  bot_enabled: boolean;
  last_manual_contact_at: string | null;
  last_customer_message_at: string | null;
  service_window_expires_at: string | null;
  presentation_accepted_at: string | null;
  video_sent_at: string | null;
  test_offer_sent_at: string | null;
  test_requested_at: string | null;
  test_refused_at: string | null;
  rejection_reason_raw_text: string | null;
  transferred_to_human_at: string | null;
  do_not_disturb: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type LeadEvent = {
  id: string;
  lead_id: string;
  event_type: string;
  old_status: LeadStatus | null;
  new_status: LeadStatus | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type LeadMessage = {
  id: string;
  lead_id: string;
  direction: "inbound" | "outbound";
  channel: "whatsapp";
  message_type: string;
  content: string | null;
  provider_message_id: string | null;
  created_at: string;
};

type ProspectingSummary = {
  mode: ProspectingMode;
  area: {
    name: string;
    cycle: number;
  };
  totalEncontrados: number;
  totalCriados: number;
  totalAtualizados: number;
  totalFalhas: number;
  leads: Lead[];
  usage: GooglePlacesUsage;
};

type LeadsPageProps = {
  onToast: (title: string, description: string, tone?: ToastTone) => void;
};

type LeadFilters = {
  cidade: string;
  segmento: string;
  status: string;
  score_minimo: string;
};

type LeadModal = "prospect" | "limits" | { lead: Lead } | null;

const statusLabels: Record<LeadStatus, string> = {
  NOVO_LEAD: "Novo lead",
  ABORDAGEM_MANUAL_PENDENTE: "Abordagem pendente",
  ABORDAGEM_MANUAL_ENVIADA: "Abordagem enviada",
  AGUARDANDO_RESPOSTA: "Aguardando resposta",
  RESPONDEU: "Respondeu",
  BOT_EM_ATENDIMENTO: "Bot em atendimento",
  APRESENTACAO_ACEITA: "Apresentação aceita",
  RECUSOU_APRESENTACAO: "Recusou apresentação",
  VIDEO_ENVIADO: "Vídeo enviado",
  TESTE_OFERTADO: "Teste ofertado",
  TESTE_SOLICITADO: "Teste solicitado",
  TESTE_RECUSADO: "Teste recusado",
  TRANSFERIDO_HUMANO: "Transferido humano",
  NAO_PERTURBAR: "Não perturbar",
  ARQUIVADO: "Arquivado",
};

const statusTone = (status: LeadStatus) => {
  if (status === "TESTE_SOLICITADO" || status === "APRESENTACAO_ACEITA") return "badge-good";
  if (status === "TESTE_RECUSADO" || status === "RECUSOU_APRESENTACAO" || status === "NAO_PERTURBAR") {
    return "badge-danger";
  }
  if (status === "AGUARDANDO_RESPOSTA" || status === "BOT_EM_ATENDIMENTO" || status === "TESTE_OFERTADO") {
    return "badge-warn";
  }
  return "badge-neutral";
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    return [error.message, error.hint].filter(Boolean).join(" ");
  }
  return error instanceof Error ? error.message : "Não foi possível concluir a ação.";
};

const scoreClass = (score: number) => {
  if (score >= 70) return "lead-score-high";
  if (score >= 40) return "lead-score-medium";
  return "lead-score-low";
};

const scoreLabel = (score: number) => {
  if (score >= 70) return "Alto potencial";
  if (score >= 40) return "Médio potencial";
  return "Baixo potencial";
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "Não registrado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
};

const getWindowState = (lead: Lead) => {
  if (!lead.service_window_expires_at) {
    return { label: "Janela não aberta", className: "badge-neutral" };
  }
  if (Date.now() < Date.parse(lead.service_window_expires_at)) {
    return { label: "Janela 24h aberta", className: "badge-good" };
  }
  return { label: "Janela expirada", className: "badge-danger" };
};

export default function LeadsPage({ onToast }: LeadsPageProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [usageModes, setUsageModes] = useState<GooglePlacesUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(true);
  const [prospecting, setProspecting] = useState(false);
  const [updatingLimits, setUpdatingLimits] = useState(false);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [leadEvents, setLeadEvents] = useState<LeadEvent[]>([]);
  const [leadMessages, setLeadMessages] = useState<LeadMessage[]>([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<LeadModal>(null);
  const [summary, setSummary] = useState<ProspectingSummary | null>(null);
  const [limitMode, setLimitMode] = useState<ProspectingMode>("complete");
  const [limitForm, setLimitForm] = useState({
    dailyLimit: "26",
    monthlyLimit: "800",
  });
  const [filters, setFilters] = useState<LeadFilters>({
    cidade: "",
    segmento: "",
    status: "",
    score_minimo: "",
  });
  const [prospectingForm, setProspectingForm] = useState({
    nicho: "",
    cidade: "",
    solucao: "catálogo web com carrinho e atendimento por WhatsApp",
  });

  const highPotentialCount = useMemo(
    () => leads.filter((lead) => lead.score >= 70).length,
    [leads],
  );
  const selectedUsage = useMemo(
    () => usageModes.find((usage) => usage.mode === "complete"),
    [usageModes],
  );
  const thirdPartyAttributions = useMemo(
    () =>
      Array.from(
        new Map(
          leads
            .flatMap((lead) => lead.google_attributions || [])
            .map((attribution) => [
              `${attribution.provider}:${attribution.providerUri || ""}`,
              attribution,
            ]),
        ).values(),
      ),
    [leads],
  );

  const updateLeadInState = (lead: Lead) => {
    setLeads((current) =>
      current
        .map((item) => (item.id === lead.id ? lead : item))
        .filter((item) => !filters.status || item.status === filters.status),
    );
    setModal((current) =>
      current && typeof current === "object" && current.lead.id === lead.id
        ? { lead }
        : current,
    );
  };

  const loadLeads = async (nextFilters: LeadFilters = filters) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      Object.entries(nextFilters).forEach(([key, value]) => {
        if (value.trim()) params.set(key, value.trim());
      });
      const suffix = params.size ? `?${params.toString()}` : "";
      const response = await api<{ success: true; data: Lead[] }>(`/api/leads${suffix}`);
      setLeads(response.data);
    } catch (requestError) {
      const message = getErrorMessage(requestError);
      setError(message);
      onToast("Falha ao carregar leads", message, "error");
    } finally {
      setLoading(false);
    }
  };

  const loadUsage = async () => {
    setUsageLoading(true);
    try {
      const response = await api<{ success: true; modes: GooglePlacesUsage[] }>(
        "/api/leads/google-places/usage",
      );
      setUsageModes(response.modes);
    } catch (requestError) {
      onToast("Falha ao carregar consumo", getErrorMessage(requestError), "error");
    } finally {
      setUsageLoading(false);
    }
  };

  const loadLeadHistory = async (lead: Lead) => {
    setHistoryLoading(true);
    try {
      const [eventsResponse, messagesResponse] = await Promise.all([
        api<{ success: true; data: LeadEvent[] }>(`/api/leads/${lead.id}/events`),
        api<{ success: true; data: LeadMessage[] }>(`/api/leads/${lead.id}/messages`),
      ]);
      setLeadEvents(eventsResponse.data);
      setLeadMessages(messagesResponse.data);
    } catch (requestError) {
      onToast("Falha ao carregar histórico", getErrorMessage(requestError), "error");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadLeads({
      cidade: "",
      segmento: "",
      status: "",
      score_minimo: "",
    });
    void loadUsage();
    // A tela é montada somente quando o admin abre a visão de leads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openProspecting = () => setModal("prospect");

  const openLeadDetails = (lead: Lead) => {
    setLeadEvents([]);
    setLeadMessages([]);
    setModal({ lead });
    void loadLeadHistory(lead);
  };

  const openUsageLimits = (mode: ProspectingMode) => {
    const usage = usageModes.find((item) => item.mode === mode);
    setLimitMode(mode);
    setLimitForm({
      dailyLimit: String(usage?.dailyLimit ?? 26),
      monthlyLimit: String(usage?.monthlyLimit ?? 800),
    });
    setModal("limits");
  };

  const handleFilter = async (event: FormEvent) => {
    event.preventDefault();
    await loadLeads();
  };

  const clearFilters = async () => {
    const emptyFilters = {
      cidade: "",
      segmento: "",
      status: "",
      score_minimo: "",
    };
    setFilters(emptyFilters);
    await loadLeads(emptyFilters);
  };

  const handleProspecting = async (event: FormEvent) => {
    event.preventDefault();
    if (selectedUsage?.blocked) {
      onToast(
        "Busca bloqueada",
        `${selectedUsage.label} está sem saldo diário ou mensal.`,
        "error",
      );
      return;
    }
    setProspecting(true);
    setError("");
    try {
      const response = await api<{
        success: true;
        data: ProspectingSummary;
        message: string;
      }>("/api/leads/prospectar", {
        method: "POST",
        body: JSON.stringify({
          nicho: prospectingForm.nicho.trim(),
          cidade: prospectingForm.cidade.trim(),
          solucao: prospectingForm.solucao.trim(),
          mode: "complete",
        }),
      });
      setSummary(response.data);
      setUsageModes((current) =>
        current.map((usage) =>
          usage.mode === response.data.mode ? response.data.usage : usage,
        ),
      );
      setModal(null);
      await Promise.all([loadLeads(), loadUsage()]);
      onToast(
        "Prospecção concluída",
        `${response.data.totalCriados} criado(s), ${response.data.totalAtualizados} atualizado(s) na região ${response.data.area.name}.`,
        "success",
      );
    } catch (requestError) {
      const message = getErrorMessage(requestError);
      setError(message);
      onToast("Falha na prospecção", message, "error");
    } finally {
      setProspecting(false);
    }
  };

  const handleUpdateLimits = async (event: FormEvent) => {
    event.preventDefault();
    setUpdatingLimits(true);
    try {
      const response = await api<{
        success: true;
        data: GooglePlacesUsage;
        message: string;
      }>(`/api/leads/google-places/usage/${limitMode}/limits`, {
        method: "PATCH",
        body: JSON.stringify({
          dailyLimit: Number(limitForm.dailyLimit),
          monthlyLimit: Number(limitForm.monthlyLimit),
        }),
      });
      setUsageModes((current) =>
        current.map((usage) => (usage.mode === limitMode ? response.data : usage)),
      );
      setModal(null);
      onToast("Limites atualizados", response.message, "success");
    } catch (requestError) {
      onToast("Falha ao atualizar limites", getErrorMessage(requestError), "error");
    } finally {
      setUpdatingLimits(false);
    }
  };

  const runLeadAction = async (
    lead: Lead,
    action: string,
    successTitle: string,
    body?: Record<string, unknown>,
  ) => {
    setUpdatingLeadId(lead.id);
    try {
      const response = await api<{ success: true; data: Lead; message: string }>(
        `/api/leads/${lead.id}/actions/${action}`,
        {
          method: "POST",
          body: body ? JSON.stringify(body) : undefined,
        },
      );
      updateLeadInState(response.data);
      if (modal && typeof modal === "object" && modal.lead.id === lead.id) {
        await loadLeadHistory(response.data);
      }
      onToast(successTitle, response.message, "success");
    } catch (requestError) {
      onToast("Falha na ação", getErrorMessage(requestError), "error");
    } finally {
      setUpdatingLeadId(null);
    }
  };

  const copyInitialMessage = async (lead: Lead) => {
    setUpdatingLeadId(lead.id);
    try {
      const response = await api<{ success: true; data: { message: string } }>(
        `/api/leads/${lead.id}/actions/initial-message`,
        { method: "POST" },
      );
      await navigator.clipboard.writeText(response.data.message);
      onToast("Mensagem copiada", `A abordagem inicial para ${lead.nome} está na área de transferência.`, "success");
    } catch (requestError) {
      onToast("Não foi possível copiar", getErrorMessage(requestError), "error");
    } finally {
      setUpdatingLeadId(null);
    }
  };

  const markTestRefused = async (lead: Lead) => {
    const reason = window.prompt("Motivo da recusa (opcional):") || "";
    await runLeadAction(lead, "test-refused", "Recusa registrada", { reason });
  };

  const archive = async (lead: Lead) => {
    if (!window.confirm(`Arquivar ${lead.nome}?`)) return;
    await runLeadAction(lead, "archive", "Lead arquivado");
  };

  const doNotDisturb = async (lead: Lead) => {
    if (!window.confirm(`Marcar ${lead.nome} como Não Perturbar?`)) return;
    await runLeadAction(lead, "do-not-disturb", "Não perturbar ativado");
  };

  return (
    <section className="leads-page">
      <header className="leads-page-header">
        <div>
          <h2>Prospecção de Leads</h2>
          <p>Busque empresas com dados completos e conduza o relacionamento com rastreabilidade.</p>
        </div>
        <button className="btn btn-primary" onClick={openProspecting} type="button">
          <Search size={16} />
          Buscar novos leads
        </button>
      </header>

      <aside className="lead-usage-guide">
        <div className="lead-usage-guide-icon">
          <CircleHelp size={18} />
        </div>
        <div>
          <h3>Fluxo seguro de escala</h3>
          <ol>
            <li>Busque leads completos com telefone.</li>
            <li>Copie a mensagem inicial e aborde manualmente.</li>
            <li>Após resposta no WhatsApp, o bot assume dentro da janela de 24h.</li>
          </ol>
          <p>
            Limite interno conservador: 800 de 1.000 eventos gratuitos mensais estimados. Nenhuma
            primeira conversa é iniciada automaticamente.
          </p>
        </div>
      </aside>

      <GooglePlacesUsagePanel
        loading={usageLoading}
        modes={usageModes}
        onConfigure={openUsageLimits}
      />

      {summary ? (
        <section aria-label="Resumo da última prospecção" className="lead-summary-grid">
          <article className="lead-summary-card">
            <span>Encontrados</span>
            <strong>{summary.totalEncontrados}</strong>
          </article>
          <article className="lead-summary-card">
            <span>Criados</span>
            <strong>{summary.totalCriados}</strong>
          </article>
          <article className="lead-summary-card">
            <span>Atualizados</span>
            <strong>{summary.totalAtualizados}</strong>
          </article>
          <article className="lead-summary-card">
            <span>{prospectingModeLabels[summary.mode]} · ciclo {summary.area.cycle}</span>
            <strong className="lead-summary-area">{summary.area.name}</strong>
          </article>
        </section>
      ) : null}

      <section className="panel">
        <header className="panel-header">
          <div>
            <h3>Leads salvos</h3>
            <p>
              {leads.length} resultado(s), sendo {highPotentialCount} de alto potencial.
            </p>
          </div>
          <div className="panel-icon">
            <Target size={16} />
          </div>
        </header>

        <div className="google-maps-attribution">
          <span>Dados de locais fornecidos por </span>
          <strong translate="no">Google Maps</strong>
          {thirdPartyAttributions.map((attribution) =>
            attribution.providerUri ? (
              <a
                href={attribution.providerUri}
                key={`${attribution.provider}:${attribution.providerUri}`}
                rel="noreferrer"
                target="_blank"
              >
                {attribution.provider}
              </a>
            ) : (
              <span key={attribution.provider}>{attribution.provider}</span>
            ),
          )}
        </div>

        <form className="lead-filters" onSubmit={handleFilter}>
          <label>
            Cidade
            <input
              maxLength={120}
              onChange={(event) => setFilters((current) => ({ ...current, cidade: event.target.value }))}
              placeholder="Ex: Belo Horizonte"
              value={filters.cidade}
            />
          </label>
          <label>
            Segmento
            <input
              maxLength={120}
              onChange={(event) => setFilters((current) => ({ ...current, segmento: event.target.value }))}
              placeholder="Ex: Confeitaria"
              value={filters.segmento}
            />
          </label>
          <label>
            Status
            <select
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              value={filters.status}
            >
              <option value="">Todos</option>
              {LEAD_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Score mínimo
            <select
              onChange={(event) => setFilters((current) => ({ ...current, score_minimo: event.target.value }))}
              value={filters.score_minimo}
            >
              <option value="">Todos</option>
              <option value="40">40 - médio</option>
              <option value="70">70 - alto</option>
            </select>
          </label>
          <div className="lead-filter-actions">
            <button className="btn btn-secondary" disabled={loading} type="submit">
              <Filter size={15} />
              Filtrar
            </button>
            <button className="btn btn-ghost" disabled={loading} onClick={clearFilters} type="button">
              Limpar
            </button>
          </div>
        </form>

        {error ? <div className="lead-inline-error">{error}</div> : null}

        <div className="table-wrap lead-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Contato</th>
                <th>Avaliação</th>
                <th>Score</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>
                    <span className="lead-loading-row">
                      <LoaderCircle className="spin" size={17} />
                      Carregando leads...
                    </span>
                  </td>
                </tr>
              ) : null}
              {!loading &&
                leads.map((lead) => {
                  const windowState = getWindowState(lead);
                  return (
                    <tr key={lead.id}>
                      <td className="lead-name-cell" data-label="Empresa">
                        <strong>{lead.nome}</strong>
                        <span>
                          {lead.segmento} ·{" "}
                          <span className="lead-mode-label">
                            {prospectingModeLabels[lead.prospecting_mode]}
                          </span>
                        </span>
                        <small>
                          <MapPin size={13} /> {lead.cidade}
                        </small>
                        <p>{lead.oportunidade_detectada}</p>
                      </td>
                      <td data-label="Contato">
                        <div className="lead-contact">
                          <span>{lead.telefone || "Sem telefone"}</span>
                          {lead.website ? (
                            <a href={lead.website} rel="noreferrer" target="_blank">
                              Abrir site <ExternalLink size={13} />
                            </a>
                          ) : (
                            <span className="muted">Sem website</span>
                          )}
                          {lead.google_maps_uri ? (
                            <a href={lead.google_maps_uri} rel="noreferrer" target="_blank">
                              Google Maps <ExternalLink size={13} />
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td data-label="Avaliação">
                        {lead.rating !== null ? (
                          <>
                            <strong>{lead.rating.toFixed(1)}</strong>
                            <span className="lead-rating-count">{lead.total_avaliacoes} avaliações</span>
                          </>
                        ) : (
                          <span className="muted">Sem avaliação</span>
                        )}
                      </td>
                      <td data-label="Score">
                        <span className={`lead-score ${scoreClass(lead.score)}`}>
                          <strong>{lead.score}</strong>
                          {scoreLabel(lead.score)}
                        </span>
                      </td>
                      <td data-label="Status">
                        <span className={`badge ${statusTone(lead.status)}`}>
                          {statusLabels[lead.status]}
                        </span>
                        <span className={`badge lead-window-badge ${windowState.className}`}>
                          {windowState.label}
                        </span>
                      </td>
                      <td data-label="Ações">
                        <div className="row-actions">
                          <button className="btn btn-secondary" onClick={() => openLeadDetails(lead)} type="button">
                            Detalhes
                          </button>
                          <button
                            className="btn btn-ghost"
                            disabled={updatingLeadId === lead.id || !lead.telefone}
                            onClick={() => void copyInitialMessage(lead)}
                            type="button"
                          >
                            <Clipboard size={14} />
                            Copiar
                          </button>
                          <button
                            className="btn btn-ghost"
                            disabled={updatingLeadId === lead.id}
                            onClick={() => void runLeadAction(lead, "manual-approach-sent", "Abordagem registrada")}
                            type="button"
                          >
                            <MessageCircle size={14} />
                            Enviada
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              {!loading && leads.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <span className="muted">
                      Nenhum lead encontrado. Inicie uma prospecção ou ajuste os filtros.
                    </span>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {modal ? (
        <div aria-modal="true" className="modal-overlay" role="dialog">
          <div className="modal-card modal-card-wide">
            <button
              aria-label="Fechar modal"
              className="modal-close-button"
              onClick={() => setModal(null)}
              type="button"
            >
              <X size={18} />
            </button>

            {modal === "prospect" ? (
              <>
                <h3>Buscar novos leads</h3>
                <p>
                  O sistema usará busca completa, uma região diferente da cidade e limite interno de
                  800 eventos mensais.
                </p>
                <form className="lead-prospect-form" onSubmit={handleProspecting}>
                  <div className="lead-selected-usage">
                    Modo {prospectingModeLabels.complete}: {prospectingModeDescriptions.complete}
                  </div>
                  <label>
                    Nicho
                    <input
                      autoFocus
                      maxLength={120}
                      onChange={(event) =>
                        setProspectingForm((current) => ({ ...current, nicho: event.target.value }))
                      }
                      placeholder="Ex: confeitarias"
                      required
                      value={prospectingForm.nicho}
                    />
                  </label>
                  <label>
                    Cidade
                    <input
                      maxLength={120}
                      onChange={(event) =>
                        setProspectingForm((current) => ({ ...current, cidade: event.target.value }))
                      }
                      placeholder="Ex: Belo Horizonte"
                      required
                      value={prospectingForm.cidade}
                    />
                  </label>
                  <label>
                    Solução oferecida
                    <textarea
                      maxLength={240}
                      onChange={(event) =>
                        setProspectingForm((current) => ({ ...current, solucao: event.target.value }))
                      }
                      required
                      value={prospectingForm.solucao}
                    />
                  </label>
                  {selectedUsage ? (
                    <div
                      className={
                        selectedUsage.blocked ? "lead-inline-error" : "lead-selected-usage"
                      }
                    >
                      Saldo: {selectedUsage.dailyRemaining} hoje e{" "}
                      {selectedUsage.monthlyRemaining} no mês.
                      {selectedUsage.blocked
                        ? " A chamada foi bloqueada para evitar cobrança."
                        : ""}
                    </div>
                  ) : null}
                  <div className="modal-actions">
                    <button className="btn btn-ghost" disabled={prospecting} onClick={() => setModal(null)} type="button">
                      Cancelar
                    </button>
                    <button
                      className="btn btn-primary"
                      disabled={
                        prospecting || usageLoading || !selectedUsage || selectedUsage.blocked
                      }
                      type="submit"
                    >
                      {prospecting ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />}
                      {prospecting ? "Buscando empresas..." : "Buscar leads"}
                    </button>
                  </div>
                </form>
              </>
            ) : modal === "limits" ? (
              <>
                <h3>Limites do modo {prospectingModeLabels[limitMode]}</h3>
                <p>
                  Use no máximo 26 por dia e 800 por mês para preservar uma margem conservadora.
                </p>
                <form className="modal-form" onSubmit={handleUpdateLimits}>
                  <label>
                    Limite diário
                    <input
                      max="26"
                      min="0"
                      onChange={(event) =>
                        setLimitForm((current) => ({
                          ...current,
                          dailyLimit: event.target.value,
                        }))
                      }
                      required
                      step="1"
                      type="number"
                      value={limitForm.dailyLimit}
                    />
                  </label>
                  <label>
                    Limite mensal
                    <input
                      max="800"
                      min="0"
                      onChange={(event) =>
                        setLimitForm((current) => ({
                          ...current,
                          monthlyLimit: event.target.value,
                        }))
                      }
                      required
                      step="1"
                      type="number"
                      value={limitForm.monthlyLimit}
                    />
                  </label>
                  <div className="modal-actions">
                    <button
                      className="btn btn-ghost"
                      disabled={updatingLimits}
                      onClick={() => setModal(null)}
                      type="button"
                    >
                      Cancelar
                    </button>
                    <button className="btn btn-primary" disabled={updatingLimits} type="submit">
                      {updatingLimits ? <LoaderCircle className="spin" size={16} /> : null}
                      Salvar limites
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h3>{modal.lead.nome}</h3>
                <p>{modal.lead.oportunidade_detectada}</p>
                <div className="lead-modal-status">
                  <span className={`badge ${statusTone(modal.lead.status)}`}>
                    {statusLabels[modal.lead.status]}
                  </span>
                  <span className={`badge ${getWindowState(modal.lead).className}`}>
                    {getWindowState(modal.lead).label}
                  </span>
                </div>
                <div className="lead-details-grid">
                  <div>
                    <span>Segmento</span>
                    <strong>{modal.lead.segmento}</strong>
                  </div>
                  <div>
                    <span>Cidade</span>
                    <strong>{modal.lead.cidade}</strong>
                  </div>
                  <div>
                    <span>Modo de qualificação</span>
                    <strong>{prospectingModeLabels[modal.lead.prospecting_mode]}</strong>
                  </div>
                  <div>
                    <span>Scores</span>
                    <strong>
                      Oportunidade {modal.lead.opportunity_score} · contato{" "}
                      {modal.lead.contact_score}
                    </strong>
                  </div>
                  <div>
                    <span>Telefone</span>
                    <strong>{modal.lead.telefone || "Não informado"}</strong>
                  </div>
                  <div>
                    <span>Última resposta</span>
                    <strong>{formatDateTime(modal.lead.last_customer_message_at)}</strong>
                  </div>
                  <div>
                    <span>Janela expira</span>
                    <strong>{formatDateTime(modal.lead.service_window_expires_at)}</strong>
                  </div>
                  <div>
                    <span>Abordagem manual</span>
                    <strong>{formatDateTime(modal.lead.last_manual_contact_at)}</strong>
                  </div>
                  {modal.lead.rejection_reason_raw_text ? (
                    <div className="lead-detail-wide">
                      <span>Motivo da recusa</span>
                      <strong>{modal.lead.rejection_reason_raw_text}</strong>
                    </div>
                  ) : null}
                  <div className="lead-detail-wide">
                    <span>Endereço</span>
                    <strong>{modal.lead.endereco || "Não informado"}</strong>
                  </div>
                  <div className="lead-detail-wide">
                    <span>Website</span>
                    {modal.lead.website ? (
                      <a href={modal.lead.website} rel="noreferrer" target="_blank">
                        {modal.lead.website}
                      </a>
                    ) : (
                      <strong>Não informado</strong>
                    )}
                  </div>
                  {modal.lead.google_maps_uri ? (
                    <div className="lead-detail-wide">
                      <span>Google Maps</span>
                      <a href={modal.lead.google_maps_uri} rel="noreferrer" target="_blank">
                        Abrir local no Google Maps <ExternalLink size={13} />
                      </a>
                    </div>
                  ) : null}
                </div>

                <div className="lead-action-grid">
                  <button
                    className="btn btn-secondary"
                    disabled={updatingLeadId === modal.lead.id || !modal.lead.telefone}
                    onClick={() => void copyInitialMessage(modal.lead)}
                    type="button"
                  >
                    <Clipboard size={15} />
                    Copiar Mensagem Inicial
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={updatingLeadId === modal.lead.id}
                    onClick={() => void runLeadAction(modal.lead, "manual-approach-sent", "Abordagem registrada")}
                    type="button"
                  >
                    <MessageCircle size={15} />
                    Marcar Abordagem Enviada
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={updatingLeadId === modal.lead.id}
                    onClick={() => void runLeadAction(modal.lead, "start-bot", "Bot iniciado")}
                    type="button"
                  >
                    <MessageCircle size={15} />
                    Iniciar Bot
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={updatingLeadId === modal.lead.id}
                    onClick={() => void runLeadAction(modal.lead, "transfer-human", "Transferido para humano")}
                    type="button"
                  >
                    <UserRound size={15} />
                    Transferir Humano
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={updatingLeadId === modal.lead.id}
                    onClick={() => void runLeadAction(modal.lead, "test-requested", "Teste registrado")}
                    type="button"
                  >
                    Teste Solicitado
                  </button>
                  <button
                    className="btn btn-danger-outline"
                    disabled={updatingLeadId === modal.lead.id}
                    onClick={() => void markTestRefused(modal.lead)}
                    type="button"
                  >
                    Teste Recusado
                  </button>
                  <button
                    className="btn btn-danger-outline"
                    disabled={updatingLeadId === modal.lead.id}
                    onClick={() => void doNotDisturb(modal.lead)}
                    type="button"
                  >
                    Não Perturbar
                  </button>
                  <button
                    className="btn btn-danger-outline"
                    disabled={updatingLeadId === modal.lead.id}
                    onClick={() => void archive(modal.lead)}
                    type="button"
                  >
                    <Archive size={15} />
                    Arquivar
                  </button>
                </div>

                <label className="lead-message-label">
                  Mensagem sugerida original
                  <textarea readOnly value={modal.lead.mensagem_sugerida} />
                </label>

                <section className="lead-history-section">
                  <header>
                    <h4>
                      <History size={15} /> Histórico
                    </h4>
                    {historyLoading ? (
                      <span className="lead-loading-row">
                        <LoaderCircle className="spin" size={15} />
                        Carregando...
                      </span>
                    ) : null}
                  </header>
                  <div className="lead-history-grid">
                    <div className="lead-history-list">
                      <strong>Eventos</strong>
                      {leadEvents.length === 0 && !historyLoading ? (
                        <span className="muted">Nenhum evento registrado.</span>
                      ) : null}
                      {leadEvents.map((event) => (
                        <article key={event.id}>
                          <span>{formatDateTime(event.created_at)}</span>
                          <strong>{event.event_type}</strong>
                          {event.new_status ? <small>{statusLabels[event.new_status]}</small> : null}
                        </article>
                      ))}
                    </div>
                    <div className="lead-history-list">
                      <strong>Mensagens</strong>
                      {leadMessages.length === 0 && !historyLoading ? (
                        <span className="muted">Nenhuma mensagem registrada.</span>
                      ) : null}
                      {leadMessages.map((message) => (
                        <article key={message.id}>
                          <span>{formatDateTime(message.created_at)}</span>
                          <strong>{message.direction === "inbound" ? "Recebida" : "Enviada"}</strong>
                          <small>{message.content || message.message_type}</small>
                        </article>
                      ))}
                    </div>
                  </div>
                </section>

                <div className="modal-actions">
                  <button className="btn btn-ghost" onClick={() => setModal(null)} type="button">
                    Fechar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
