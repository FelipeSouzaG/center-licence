import { ShieldCheck } from "lucide-react";
import AdminKpiGrid from "../components/AdminKpiGrid";
import { Card } from "../components/AdminUi";
import type { DashboardStats, Tenant } from "../types/domain";

type DashboardPageProps = {
  loading: boolean;
  stats: DashboardStats;
  tenants: Tenant[];
};

export default function DashboardPage({ loading, stats, tenants }: DashboardPageProps) {
  return (
    <>
      <AdminKpiGrid loading={loading} stats={stats} />

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
      </section>
    </>
  );
}
