export type Tenant = {
  id: string;
  company_name: string;
  monthly_price: number;
  pending_monthly_price: number | null;
  pending_price_effective_at: string | null;
  created_at: string;
  billing_mode: "ALWAYS_FREE" | "FREE" | "NORMAL";
  system_name: string;
  latest_license_id: string | null;
  latest_license_expires_at: string | null;
  latest_license_status: "trial" | "active" | "grace" | "expired" | "missing";
  latest_license_grace_until: string | null;
};

export type Payment = {
  id: string;
  tenant_id: string;
  amount: number;
  currency: string;
  status: string;
  external_reference: string;
  preference_id: string | null;
  payment_id: string | null;
  approved_at: string | null;
  created_at: string;
};

export type DashboardStats = {
  mrr: number;
  inGrace: number;
  expired: number;
  pendingPayments: number;
  totalTenants: number;
};
