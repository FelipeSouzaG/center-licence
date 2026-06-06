import { useMemo } from "react";
import { Building2, ShieldCheck, Trash2, Users } from "lucide-react";
import AdminKpiGrid from "../components/AdminKpiGrid";
import { Badge, Card, type BadgeTone } from "../components/AdminUi";
import { billingModeLabels } from "../constants/billing";
import type { DashboardStats, Tenant } from "../types/domain";
import { formatDate, formatMoney } from "../utils/format";

type TenantsPageProps = {
  dueDayFilter: string;
  loading: boolean;
  pricingDrafts: Record<string, string>;
  stats: DashboardStats;
  tenantSearch: string;
  tenants: Tenant[];
  onDeleteTenant: (tenantId: string, companyName: string) => void;
  onDueDayFilterChange: (value: string) => void;
  onEditTenant: (tenant: Tenant) => void;
  onManageOwner: (tenant: Tenant) => void;
  onManualRenew: (tenant: Tenant) => void;
  onOpenDetails: (tenant: Tenant) => void;
  onPricingDraftChange: (tenantId: string, value: string) => void;
  onSchedulePrice: (tenantId: string) => void;
  onTenantSearchChange: (value: string) => void;
};

const toneFromLicenseStatus = (status: Tenant["latest_license_status"]): BadgeTone => {
  if (status === "trial") return "warn";
  if (status === "active") return "good";
  if (status === "grace") return "warn";
  if (status === "expired") return "danger";
  return "neutral";
};

export default function TenantsPage({
  dueDayFilter,
  loading,
  pricingDrafts,
  stats,
  tenantSearch,
  tenants,
  onDeleteTenant,
  onDueDayFilterChange,
  onEditTenant,
  onManageOwner,
  onManualRenew,
  onOpenDetails,
  onPricingDraftChange,
  onSchedulePrice,
  onTenantSearchChange,
}: TenantsPageProps) {
  const filteredTenants = useMemo(() => {
    const text = tenantSearch.trim().toLowerCase();

    return tenants.filter((tenant) => {
      const matchesText =
        !text ||
        tenant.company_name.toLowerCase().includes(text) ||
        tenant.system_name.toLowerCase().includes(text) ||
        String((tenant as Tenant & { cpf_cnpj?: string }).cpf_cnpj || "")
          .toLowerCase()
          .includes(text);

      if (!matchesText) return false;
      if (!dueDayFilter) return true;
      if (!tenant.latest_license_expires_at) return false;

      return new Date(tenant.latest_license_expires_at).getDate() === Number(dueDayFilter);
    });
  }, [dueDayFilter, tenantSearch, tenants]);

  return (
    <>
      <AdminKpiGrid loading={loading} stats={stats} />

      <Card title="Gestão de Tenants" subtitle="Cadastro, preço, owner e ciclo de licença" icon={<Users size={16} />}>
        <div className="tenant-filters">
          <div className="tenant-filters-grid">
            <label>
              Buscar por nome/sistema/cpf-cnpj
              <input
                onChange={(event) => onTenantSearchChange(event.target.value)}
                placeholder="Digite para filtrar..."
                value={tenantSearch}
              />
            </label>
            <label>
              Vencimento no dia
              <select onChange={(event) => onDueDayFilterChange(event.target.value)} value={dueDayFilter}>
                <option value="">Todos</option>
                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                  <option key={day} value={String(day)}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Sistema</th>
                <th>Modalidade</th>
                <th>Cadastro</th>
                <th>Mensalidade</th>
                <th>Próximo preço</th>
                <th>Licença</th>
                <th>Vencimento</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td>
                    <strong>{tenant.company_name}</strong>
                  </td>
                  <td>{tenant.system_name}</td>
                  <td>
                    <Badge
                      label={billingModeLabels[tenant.billing_mode]}
                      tone={tenant.billing_mode === "NORMAL" ? "neutral" : "good"}
                    />
                  </td>
                  <td>{formatDate(tenant.created_at)}</td>
                  <td>{tenant.billing_mode === "NORMAL" ? formatMoney(tenant.monthly_price) : "Gratuito"}</td>
                  <td>
                    {tenant.billing_mode === "NORMAL" && tenant.pending_monthly_price
                      ? `${formatMoney(tenant.pending_monthly_price)} em ${formatDate(tenant.pending_price_effective_at)}`
                      : "-"}
                  </td>
                  <td>
                    <Badge
                      label={tenant.latest_license_status.toUpperCase()}
                      tone={toneFromLicenseStatus(tenant.latest_license_status)}
                    />
                  </td>
                  <td>{formatDate(tenant.latest_license_expires_at)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-secondary" onClick={() => onOpenDetails(tenant)} type="button">
                        Detalhes
                      </button>
                      <button className="btn btn-danger-outline" onClick={() => onManualRenew(tenant)} type="button">
                        <ShieldCheck size={15} /> Renovar
                      </button>
                      <button className="btn btn-ghost" onClick={() => onEditTenant(tenant)} type="button">
                        <Building2 size={15} /> Editar
                      </button>
                      <button className="btn btn-ghost" onClick={() => onManageOwner(tenant)} type="button">
                        <Users size={15} /> OWNER
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => onDeleteTenant(tenant.id, tenant.company_name)}
                        type="button"
                      >
                        <Trash2 size={15} /> Excluir
                      </button>
                    </div>
                    {tenant.billing_mode === "NORMAL" ? (
                      <div className="row-price-editor">
                        <input
                          inputMode="decimal"
                          onChange={(event) => onPricingDraftChange(tenant.id, event.target.value)}
                          placeholder="Novo valor"
                          value={pricingDrafts[tenant.id] || ""}
                        />
                        <button className="btn btn-ghost" onClick={() => onSchedulePrice(tenant.id)} type="button">
                          Agendar preço
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <span className="muted">Nenhum tenant encontrado com os filtros atuais.</span>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
