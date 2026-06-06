import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Clipboard,
  ExternalLink,
  Filter,
  LoaderCircle,
  MapPin,
  Search,
  Target,
  X,
} from "lucide-react";
import { api, ApiError } from "../lib/api";

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
  google_place_id: string;
  rating: number | null;
  total_avaliacoes: number;
  fonte: string;
  score: number;
  oportunidade_detectada: string;
  mensagem_sugerida: string;
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
  totalEncontrados: number;
  totalCriados: number;
  totalAtualizados: number;
  totalFalhas: number;
  leads: Lead[];
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
  const [loading, setLoading] = useState(true);
  const [prospecting, setProspecting] = useState(false);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"prospect" | { lead: Lead } | null>(null);
  const [summary, setSummary] = useState<ProspectingSummary | null>(null);
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

  useEffect(() => {
    void loadLeads({
      cidade: "",
      segmento: "",
      status: "",
      score_minimo: "",
    });
    // A tela é montada somente quando o admin abre a visão de leads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        }),
      });
      setSummary(response.data);
      setModal(null);
      await loadLeads();
      onToast(
        "Prospecção concluída",
        `${response.data.totalCriados} criado(s) e ${response.data.totalAtualizados} atualizado(s).`,
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
          <p>Busque empresas públicas por nicho e cidade e organize a abordagem comercial.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal("prospect")} type="button">
          <Search size={16} />
          Buscar novos leads
        </button>
      </header>

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
            <span>Falhas nos detalhes</span>
            <strong>{summary.totalFalhas}</strong>
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
                    <td className="lead-name-cell">
                      <strong>{lead.nome}</strong>
                      <span>{lead.segmento}</span>
                      <small>
                        <MapPin size={13} /> {lead.cidade}
                      </small>
                      <p>{lead.oportunidade_detectada}</p>
                    </td>
                    <td>
                      <div className="lead-contact">
                        <span>{lead.telefone || "Sem telefone"}</span>
                        {lead.website ? (
                          <a href={lead.website} rel="noreferrer" target="_blank">
                            Abrir site <ExternalLink size={13} />
                          </a>
                        ) : (
                          <span className="muted">Sem website</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {lead.rating !== null ? (
                        <>
                          <strong>{lead.rating.toFixed(1)}</strong>
                          <span className="lead-rating-count">{lead.total_avaliacoes} avaliações</span>
                        </>
                      ) : (
                        <span className="muted">Sem avaliação</span>
                      )}
                    </td>
                    <td>
                      <span className={`lead-score ${scoreClass(lead.score)}`}>
                        <strong>{lead.score}</strong>
                        {scoreLabel(lead.score)}
                      </span>
                    </td>
                    <td>
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
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-secondary" onClick={() => setModal({ lead })} type="button">
                          Detalhes
                        </button>
                        <button className="btn btn-ghost" onClick={() => void copyMessage(lead)} type="button">
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
                <p>A busca usa Google Places e salva empresas sem duplicar o identificador do local.</p>
                <form className="lead-prospect-form" onSubmit={handleProspecting}>
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
                  <div className="modal-actions">
                    <button className="btn btn-ghost" disabled={prospecting} onClick={() => setModal(null)} type="button">
                      Cancelar
                    </button>
                    <button className="btn btn-primary" disabled={prospecting} type="submit">
                      {prospecting ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />}
                      {prospecting ? "Buscando empresas..." : "Buscar leads"}
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
                </div>
                <label className="lead-message-label">
                  Mensagem sugerida
                  <textarea readOnly value={modal.lead.mensagem_sugerida} />
                </label>
                <div className="modal-actions">
                  <button className="btn btn-ghost" onClick={() => setModal(null)} type="button">
                    Fechar
                  </button>
                  <button className="btn btn-primary" onClick={() => void copyMessage(modal.lead)} type="button">
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
