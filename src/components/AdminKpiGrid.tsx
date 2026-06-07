import { AlertTriangle, Building2, CreditCard, ReceiptText } from "lucide-react";
import type { DashboardStats } from "../types/domain";
import { formatMoney } from "../utils/format";
import { Card } from "./AdminUi";

type AdminKpiGridProps = {
  loading: boolean;
  stats: DashboardStats;
};

export default function AdminKpiGrid({ loading, stats }: AdminKpiGridProps) {
  if (loading) {
    return (
      <section className="kpi-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <section className="panel skeleton-card" key={`kpi-skeleton-${index}`}>
            <div className="skeleton-line skeleton-lg" />
            <div className="skeleton-line skeleton-md" />
          </section>
        ))}
      </section>
    );
  }

  return (
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
  );
}
