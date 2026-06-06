import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CircleHelp,
  Clipboard,
  ExternalLink,
  Filter,
  LoaderCircle,
  MapPin,
  Search,
  Target,
  X,
} from "lucide-react";
import GooglePlacesUsagePanel from "../components/GooglePlacesUsagePanel";
import { api, ApiError } from "../lib/api";
import {
  PROSPECTING_MODES,
  prospectingModeDescriptions,
  prospectingModeLabels,
  type GooglePlacesUsage,
  type ProspectingMode,
} from "../types/leads";

const LEAD_STATUSES = [
  "novo",
  "qualificado",
  "contatado",
  "respondeu",
  "reuniao",
  "proposta",
  "ganho",
  "perdido",
  "descartado",
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
  prospecting_mode: ProspectingMode;
  google_attributions: Array<{
    provider: string;
    providerUri: string | null;
  }>;
  google_data_expires_at: string;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
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
  novo: "Novo",
  qualificado: "Qualificado",
  contatado: "Contatado",
  respondeu: "Respondeu",
  reuniao: "Reunião",
  proposta: "Proposta",
  ganho: "Ganho",
  perdido: "Perdido",
  descartado: "Descartado",
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

export default function LeadsPage({ onToast }: LeadsPageProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [usageModes, setUsageModes] = useState<GooglePlacesUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(true);
  const [prospecting, setProspecting] = useState(false);
  const [updatingLimits, setUpdatingLimits] = useState(false);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<LeadModal>(null);
  const [summary, setSummary] = useState<ProspectingSummary | null>(null);
  const [limitMode, setLimitMode] = useState<ProspectingMode>("economic");
  const [limitForm, setLimitForm] = useState({
    dailyLimit: "500",
    monthlyLimit: "999999",
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
    mode: "economic" as ProspectingMode,
  });

  const highPotentialCount = useMemo(
    () => leads.filter((lead) => lead.score >= 70).length,
    [leads],
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
  const selectedUsage = useMemo(
    () => usageModes.find((usage) => usage.mode === prospectingForm.mode),
    [prospectingForm.mode, usageModes],
  );

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

  const openProspecting = () => {
    setProspectingForm((current) => ({ ...current, mode: "economic" }));
    setModal("prospect");
  };

  const openUsageLimits = (mode: ProspectingMode) => {
    const usage = usageModes.find((item) => item.mode === mode);
    setLimitMode(mode);
    setLimitForm({
      dailyLimit: String(usage?.dailyLimit ?? 0),
      monthlyLimit: String(usage?.monthlyLimit ?? 0),
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
        `O modo ${selectedUsage.label} está sem saldo diário ou mensal.`,
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
          mode: prospectingForm.mode,
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

  const updateStatus = async (lead: Lead, status: LeadStatus) => {
    setUpdatingLeadId(lead.id);
    try {
      const response = await api<{ success: true; data: Lead; message: string }>(
        `/api/leads/${lead.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      );
      setLeads((current) =>
        current
          .map((item) => (item.id === lead.id ? response.data : item))
          .filter((item) => !filters.status || item.status === filters.status),
      );
      setModal((current) =>
        current && typeof current === "object" && current.lead.id === lead.id
          ? { lead: response.data }
          : current,
      );
      onToast("Status atualizado", `${lead.nome} agora está como ${statusLabels[status]}.`, "success");
    } catch (requestError) {
      onToast("Falha ao alterar status", getErrorMessage(requestError), "error");
    } finally {
      setUpdatingLeadId(null);
    }
  };

  const copyMessage = async (lead: Lead) => {
    try {
      await navigator.clipboard.writeText(lead.mensagem_sugerida);
      onToast("Mensagem copiada", `A abordagem para ${lead.nome} está na área de transferência.`, "success");
    } catch {
      onToast("Não foi possível copiar", "Selecione a mensagem nos detalhes e copie manualmente.", "error");
    }
  };

  return (
    <section className="leads-page">
      <header className="leads-page-header">
        <div>
          <h2>Prospecção de Leads</h2>
          <p>Busque empresas por nicho com rotação automática entre regiões da cidade.</p>
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
          <h3>Como buscar leads</h3>
          <ol>
            <li>Clique em <strong>Buscar novos leads</strong>.</li>
            <li>Escolha o modo e informe nicho, cidade e solução.</li>
            <li>Confirme em <strong>Buscar leads</strong> e aguarde a conclusão.</li>
          </ol>
          <p>
            A cada execução o backend reserva uma macroregião ainda não pesquisada para o mesmo nicho,
            controla a cota antes da chamada e salva sem duplicar empresas. Nenhuma mensagem é enviada
            automaticamente.
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
                leads.map((lead) => (
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
                      <select
                        aria-label={`Status de ${lead.nome}`}
                        className="lead-status-select"
                        disabled={updatingLeadId === lead.id}
                        onChange={(event) => void updateStatus(lead, event.target.value as LeadStatus)}
                        value={lead.status}
                      >
                        {LEAD_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {statusLabels[status]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td data-label="Ações">
                      <div className="row-actions">
                        <button className="btn btn-secondary" onClick={() => setModal({ lead })} type="button">
                          Detalhes
                        </button>
                        <button
                          className="btn btn-ghost"
                          disabled={lead.prospecting_mode === "economic"}
                          onClick={() => void copyMessage(lead)}
                          title={
                            lead.prospecting_mode === "economic"
                              ? "Qualifique o candidato no modo Básico ou Completo antes da abordagem."
                              : undefined
                          }
                          type="button"
                        >
                          <Clipboard size={14} />
                          Copiar mensagem
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
            <button aria-label="Fechar modal" className="modal-close-button" onClick={() => setModal(null)} type="button">
              <X size={18} />
            </button>

            {modal === "prospect" ? (
              <>
                <h3>Buscar novos leads</h3>
                <p>
                  O sistema usará uma região diferente da cidade até completar o ciclo territorial.
                </p>
                <form className="lead-prospect-form" onSubmit={handleProspecting}>
                  <label>
                    Modo de busca
                    <select
                      onChange={(event) =>
                        setProspectingForm((current) => ({
                          ...current,
                          mode: event.target.value as ProspectingMode,
                        }))
                      }
                      value={prospectingForm.mode}
                    >
                      {PROSPECTING_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {prospectingModeLabels[mode]}
                        </option>
                      ))}
                    </select>
                    <small className="lead-mode-description">
                      {prospectingModeDescriptions[prospectingForm.mode]}
                    </small>
                  </label>
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
                      Saldo do modo {selectedUsage.label}: {selectedUsage.dailyRemaining} hoje e{" "}
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
                  Os máximos administrativos mantêm uma margem abaixo das franquias de uso. Reduza os
                  valores quando quiser operar de forma ainda mais conservadora.
                </p>
                <form className="modal-form" onSubmit={handleUpdateLimits}>
                  <label>
                    Limite diário
                    <input
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
                <div className="google-maps-attribution">
                  <span>Dados de locais fornecidos por </span>
                  <strong translate="no">Google Maps</strong>
                  {(modal.lead.google_attributions || []).map((attribution) =>
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
                    <span>Avaliação</span>
                    <strong>
                      {modal.lead.rating !== null
                        ? `${modal.lead.rating.toFixed(1)} (${modal.lead.total_avaliacoes})`
                        : "Não informada"}
                    </strong>
                  </div>
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
                <label className="lead-message-label">
                  Mensagem sugerida
                  <textarea readOnly value={modal.lead.mensagem_sugerida} />
                </label>
                <div className="modal-actions">
                  <button className="btn btn-ghost" onClick={() => setModal(null)} type="button">
                    Fechar
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={modal.lead.prospecting_mode === "economic"}
                    onClick={() => void copyMessage(modal.lead)}
                    type="button"
                  >
                    <Clipboard size={15} />
                    Copiar mensagem
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
