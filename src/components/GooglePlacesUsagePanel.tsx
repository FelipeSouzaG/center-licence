import { LoaderCircle, Settings2, ShieldCheck, TriangleAlert } from "lucide-react";
import type { GooglePlacesUsage, ProspectingMode } from "../types/leads";

type GooglePlacesUsagePanelProps = {
  loading: boolean;
  modes: GooglePlacesUsage[];
  onConfigure: (mode: ProspectingMode) => void;
};

const formatCount = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

const percentage = (used: number, limit: number) => {
  if (limit <= 0) return 100;
  return Math.min(100, Math.round((used / limit) * 100));
};

export default function GooglePlacesUsagePanel({
  loading,
  modes,
  onConfigure,
}: GooglePlacesUsagePanelProps) {
  return (
    <section className="panel places-usage-panel">
      <header className="panel-header">
        <div>
          <h3>Consumo Google Places</h3>
          <p>Reservas internas bloqueiam a chamada antes de ultrapassar os limites configurados.</p>
        </div>
        <div className="panel-icon">
          <ShieldCheck size={17} />
        </div>
      </header>

      {loading ? (
        <span className="lead-loading-row">
          <LoaderCircle className="spin" size={17} />
          Carregando consumo...
        </span>
      ) : (
        <div className="places-usage-grid">
          {modes.map((usage) => {
            const dailyPercent = percentage(usage.dailyUsed, usage.dailyLimit);
            const monthlyPercent = percentage(usage.monthlyUsed, usage.monthlyLimit);
            const warning = dailyPercent >= 80 || monthlyPercent >= 80;

            return (
              <article
                className={`places-usage-card${usage.blocked ? " is-blocked" : warning ? " is-warning" : ""}`}
                key={usage.mode}
              >
                <div className="places-usage-card-header">
                  <div>
                    <strong>{usage.label}</strong>
                    <span>{usage.description}</span>
                  </div>
                  {usage.blocked ? (
                    <span className="badge badge-danger">Bloqueado</span>
                  ) : warning ? (
                    <span className="badge badge-warn">
                      <TriangleAlert size={12} /> Atenção
                    </span>
                  ) : (
                    <span className="badge badge-good">Disponível</span>
                  )}
                </div>

                <div className="places-usage-metric">
                  <div>
                    <span>Hoje</span>
                    <strong>
                      {formatCount(usage.dailyUsed)} / {formatCount(usage.dailyLimit)}
                    </strong>
                    <small>{formatCount(usage.dailyRemaining)} restantes</small>
                  </div>
                  <div aria-label={`${dailyPercent}% do limite diário`} className="usage-progress">
                    <span style={{ width: `${dailyPercent}%` }} />
                  </div>
                </div>

                <div className="places-usage-metric">
                  <div>
                    <span>Mês</span>
                    <strong>
                      {formatCount(usage.monthlyUsed)} / {formatCount(usage.monthlyLimit)}
                    </strong>
                    <small>{formatCount(usage.monthlyRemaining)} restantes</small>
                  </div>
                  <div aria-label={`${monthlyPercent}% do limite mensal`} className="usage-progress">
                    <span style={{ width: `${monthlyPercent}%` }} />
                  </div>
                </div>

                <button
                  className="btn btn-ghost places-usage-configure"
                  onClick={() => onConfigure(usage.mode)}
                  type="button"
                >
                  <Settings2 size={14} />
                  Configurar limites
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
