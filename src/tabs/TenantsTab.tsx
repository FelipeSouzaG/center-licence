import { Building2, ShieldCheck, Trash2, Users } from "lucide-react";
import type React from "react";
import { Badge, Card, billingModeLabels, formatDate, formatMoney } from "./tabShared";

type Tenant = {
  id: string;
  company_name: string;
  system_name: string;
  monthly_price: number;
  pending_monthly_price: number | null;
  pending_price_effective_at: string | null;
  created_at: string;
  billing_mode: "ALWAYS_FREE" | "FREE" | "NORMAL";
  latest_license_expires_at: string | null;
  latest_license_status: "trial" | "active" | "grace" | "expired" | "missing";
};

type Props = {
  tenants: Tenant[];
  tenantSearch: string;
  dueDayFilter: string;
  pricingDrafts: Record<string, string>;
  setTenantSearch: (value: string) => void;
  setDueDayFilter: (value: string) => void;
  setPricingDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  toneFromLicenseStatus: (status: Tenant["latest_license_status"]) => "good" | "warn" | "danger" | "neutral";
  onDetails: (tenant: Tenant) => void;
  onRenew: (tenant: Tenant) => void;
  onEdit: (tenant: Tenant) => void;
  onOwner: (tenant: Tenant) => void;
  onDelete: (tenantId: string, companyName: string) => void;
  onSchedulePrice: (tenantId: string) => void;
};

export function TenantsTab({
  tenants,
  tenantSearch,
  dueDayFilter,
  pricingDrafts,
  setTenantSearch,
  setDueDayFilter,
  setPricingDrafts,
  toneFromLicenseStatus,
  onDetails,
  onRenew,
  onEdit,
  onOwner,
  onDelete,
  onSchedulePrice,
}: Props) {
  return (
    <Card title="Gestão de Tenants" subtitle="Cadastro, preço, owner e ciclo de licença" icon={<Users size={16} />}>
      <div className="tenant-filters">
        <div className="tenant-filters-grid">
          <label>
            Buscar por nome/sistema/cpf-cnpj
            <input onChange={(event) => setTenantSearch(event.target.value)} placeholder="Digite para filtrar..." value={tenantSearch} />
          </label>
          <label>
            Vencimento no dia
            <select onChange={(event) => setDueDayFilter(event.target.value)} value={dueDayFilter}>
              <option value="">Todos</option>
              {Array.from({ length: 31 }, (_, idx) => idx + 1).map((day) => (
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
            {tenants.map((tenant) => (
              <tr key={tenant.id}>
                <td>
                  <strong>{tenant.company_name}</strong>
                </td>
                <td>{tenant.system_name}</td>
                <td>
                  <Badge label={billingModeLabels[tenant.billing_mode]} tone={tenant.billing_mode === "NORMAL" ? "neutral" : "good"} />
                </td>
                <td>{formatDate(tenant.created_at)}</td>
                <td>{tenant.billing_mode === "NORMAL" ? formatMoney(tenant.monthly_price) : "Gratuito"}</td>
                <td>
                  {tenant.billing_mode === "NORMAL" && tenant.pending_monthly_price
                    ? `${formatMoney(tenant.pending_monthly_price)} em ${formatDate(tenant.pending_price_effective_at)}`
                    : "-"}
                </td>
                <td>
                  <Badge label={tenant.latest_license_status.toUpperCase()} tone={toneFromLicenseStatus(tenant.latest_license_status)} />
                </td>
                <td>{formatDate(tenant.latest_license_expires_at)}</td>
                <td>
                  <div className="row-actions">
                    <button className="btn btn-secondary" onClick={() => onDetails(tenant)} type="button">
                      Detalhes
                    </button>
                    <button className="btn btn-danger-outline" onClick={() => onRenew(tenant)} type="button">
                      <ShieldCheck size={15} /> Renovar
                    </button>
                    <button className="btn btn-ghost" onClick={() => onEdit(tenant)} type="button">
                      <Building2 size={15} /> Editar
                    </button>
                    <button className="btn btn-ghost" onClick={() => onOwner(tenant)} type="button">
                      <Users size={15} /> OWNER
                    </button>
                    <button className="btn btn-danger" onClick={() => onDelete(tenant.id, tenant.company_name)} type="button">
                      <Trash2 size={15} /> Excluir
                    </button>
                  </div>
                  {tenant.billing_mode === "NORMAL" ? (
                    <div className="row-price-editor">
                      <input
                        inputMode="decimal"
                        onChange={(event) =>
                          setPricingDrafts((prev) => ({
                            ...prev,
                            [tenant.id]: event.target.value,
                          }))
                        }
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
            {tenants.length === 0 ? (
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
  );
}
