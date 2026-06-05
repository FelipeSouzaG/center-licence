import { AlertTriangle, Building2, CreditCard, ReceiptText, ShieldCheck } from "lucide-react";
import { Badge, Card, formatMoney } from "./tabShared";

type Tenant = {
  latest_license_status: "trial" | "active" | "grace" | "expired" | "missing";
};

type DashboardStats = {
  mrr: number;
  inGrace: number;
  expired: number;
  pendingPayments: number;
  totalTenants: number;
};

export function DashboardTab({ loading, stats, tenants }: { loading: boolean; stats: DashboardStats; tenants: Tenant[] }) {
  if (loading) {
    return (
      <section className="kpi-grid">
        {Array.from({ length: 4 }, (_, idx) => (
          <section className="panel skeleton-card" key={`dashboard-skeleton-${idx}`}>
            <div className="skeleton-line skeleton-lg" />
            <div className="skeleton-line skeleton-md" />
          </section>
        ))}
      </section>
    );
  }

  return (
    <section className="dashboard-tab">
      <section className="kpi-grid">
        <Card icon={<Building2 size={16} />} subtitle="Clientes ativos" title="Tenants">
          <strong className="kpi-value">{stats.totalTenants}</strong>
        </Card>
        <Card icon={<CreditCard size={16} />} subtitle="Receita mensal projetada" title="MRR">
          <strong className="kpi-value">{formatMoney(stats.mrr)}</strong>
        </Card>
        <Card icon={<AlertTriangle size={16} />} subtitle="Licenças em carência" title="Em risco">
          <strong className="kpi-value">{stats.inGrace}</strong>
        </Card>
        <Card icon={<ReceiptText size={16} />} subtitle="Cobranças aguardando" title="Pendentes">
          <strong className="kpi-value">{stats.pendingPayments}</strong>
        </Card>
      </section>

      <section className="view-grid">
        <Card title="Saúde de licenciamento" subtitle="Visão geral dos tenants" icon={<ShieldCheck size={16} />}>
          <div className="mini-list">
            <div>
              <span>Trial</span>
              <strong>{tenants.filter((tenant) => tenant.latest_license_status === "trial").length}</strong>
            </div>
            <div>
              <span>Ativas</span>
              <strong>{tenants.filter((tenant) => tenant.latest_license_status === "active").length}</strong>
            </div>
            <div>
              <span>Carência</span>
              <strong>{stats.inGrace}</strong>
            </div>
            <div>
              <span>Expiradas/Ausentes</span>
              <strong>{stats.expired}</strong>
            </div>
          </div>
        </Card>

        <Card title="Próximo foco" subtitle="Operação comercial da central" icon={<Building2 size={16} />}>
          <div className="mini-list">
            <div>
              <span>Validação</span>
              <strong>Licença paga</strong>
            </div>
            <div>
              <span>Entrada</span>
              <strong>Lead com dor</strong>
            </div>
            <div>
              <span>Sinal</span>
              <Badge label="SISTEMA" tone="good" />
            </div>
          </div>
        </Card>
      </section>
    </section>
  );
}
