import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "./lib/api";
import {
  AlertTriangle,
  Building2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  ReceiptText,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";

type Role = "ADMIN" | "OWNER";

type User = {
  id: string;
  email: string;
  role: Role;
  tenant_id: string | null;
  password_must_change?: boolean;
};

type UserProfile = User & {
  is_active: boolean;
  created_at: string | null;
  last_login_at: string | null;
};

type Tenant = {
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

type Payment = {
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

type LicenseResponse = {
  license: {
    id: string;
    token: string;
    status: string;
    effective_status: string;
    expires_at: string;
    grace_until: string | null;
  } | null;
};

type OwnerProfile = {
  id: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  password_must_change?: boolean;
};

type OwnerEnvironment = {
  owner: {
    id: string;
    email: string;
    tenant_id: string;
  };
  tenant: {
    id: string;
    company_name: string;
    system_name: string;
    monthly_price: number;
    billing_mode: Tenant["billing_mode"];
    created_at: string | null;
  };
  license: {
    id: string;
    status: string;
    effective_status: Tenant["latest_license_status"] | string;
    expires_at: string;
    grace_until: string | null;
  } | null;
  payments: Payment[];
  stats: {
    total_payments: number;
    approved_payments: number;
    pending_payments: number;
    approved_total_amount: number;
  };
};

type ViewKey = "overview" | "tenants" | "owner_home" | "owner_payments" | "owner_system";

type ToastTone = "success" | "error" | "info";

type Toast = {
  id: string;
  title: string;
  description: string;
  tone: ToastTone;
};

type ModalState =
  | { kind: "none" }
  | {
      kind: "confirm";
      title: string;
      description: string;
      confirmLabel: string;
      tone: "primary" | "danger";
      action: () => Promise<void>;
    }
  | {
      kind: "createTenant";
    }
  | {
      kind: "editTenant";
      tenantId: string;
    }
  | {
      kind: "manageOwner";
      tenantId: string;
      tenantName: string;
    }
  | {
      kind: "tenantDetails";
      tenantId: string;
      tenantName: string;
    }
  | {
      kind: "info";
      title: string;
      description: string;
    }
  | {
      kind: "profileSettings";
    };

const formatMoney = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString("pt-BR") : "-");

const parseNumberInput = (value: unknown): number => {
  if (typeof value === "number") return value;
  const raw = String(value ?? "").trim();
  if (!raw) return Number.NaN;

  const cleaned = raw.replace(/[R$\s\u00A0]/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  let normalized = cleaned;
  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = cleaned.replace(/,/g, "");
  }

  return Number(normalized);
};

function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "good" | "warn" | "danger" }) {
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

function Card({ title, subtitle, icon, children }: { title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {icon ? <div className="panel-icon">{icon}</div> : null}
      </header>
      <div>{children}</div>
    </section>
  );
}

const toastToneToClass: Record<ToastTone, string> = {
  success: "toast-success",
  error: "toast-error",
  info: "toast-info",
};

const billingModeLabels: Record<Tenant["billing_mode"], string> = {
  ALWAYS_FREE: "Sempre gratuito",
  FREE: "Gratuito (30+3)",
  NORMAL: "Normal (cobrança mensal)",
};

const adminViewOptions: Array<{ key: ViewKey; label: string; icon: React.ReactNode }> = [
  { key: "overview", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
  { key: "tenants", label: "Tenants", icon: <Users size={16} /> },
];

const ownerViewOptions: Array<{ key: ViewKey; label: string; icon: React.ReactNode }> = [
  { key: "owner_home", label: "Meu ambiente", icon: <LayoutDashboard size={16} /> },
  { key: "owner_payments", label: "Pagamentos", icon: <ReceiptText size={16} /> },
  { key: "owner_system", label: "Sistema", icon: <Building2 size={16} /> },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [view, setView] = useState<ViewKey>("overview");
  const [tenantSearch, setTenantSearch] = useState("");
  const [dueDayFilter, setDueDayFilter] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotPhone, setForgotPhone] = useState("");
  const [recoveryLink, setRecoveryLink] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [authView, setAuthView] = useState<"login" | "recovery">("login");

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [pricingDrafts, setPricingDrafts] = useState<Record<string, string>>({});

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [modalLoading, setModalLoading] = useState(false);
  const [tenantDetails, setTenantDetails] = useState<{
    loading: boolean;
    payments: Payment[];
    license: LicenseResponse["license"];
  }>({
    loading: false,
    payments: [],
    license: null,
  });

  const [tenantForm, setTenantForm] = useState({
    company_name: "",
    system_name: "",
    monthly_price: "",
    billing_mode: "NORMAL" as Tenant["billing_mode"],
    owner_email: "",
    owner_phone: "",
    owner_password: "",
  });
  const [tenantEditForm, setTenantEditForm] = useState({
    company_name: "",
    system_name: "",
    monthly_price: "",
    billing_mode: "NORMAL" as Tenant["billing_mode"],
  });
  const [ownerForm, setOwnerForm] = useState({
    loaded: false,
    ownerExists: false,
    email: "",
    phone: "",
    new_password: "",
    is_active: true,
    created_at: null as string | null,
    last_login_at: null as string | null,
  });
  const [ownerEnvironment, setOwnerEnvironment] = useState<OwnerEnvironment | null>(null);
  const [viewTransitionKey, setViewTransitionKey] = useState(0);
  const [profileForm, setProfileForm] = useState({
    email: "",
    current_password: "",
    new_password: "",
  });

  const currentTenant = useMemo(() => {
    if (!user?.tenant_id) return null;
    return tenants.find((tenant) => tenant.id === user.tenant_id) || null;
  }, [tenants, user?.tenant_id]);
  const navOptions = user?.role === "ADMIN" ? adminViewOptions : ownerViewOptions;

  const addToast = (title: string, description: string, tone: ToastTone = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, title, description, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4200);
  };

  const openRequestErrorModal = useCallback((err: unknown, title = "Falha na comunicação com o servidor") => {
    if (err instanceof ApiError) {
      const parts = [err.message];
      if (err.hint) parts.push(err.hint);
      if (err.status === 404 && !err.hint) {
        parts.push(
          "Publique o backend com `npm run deploy` em `central-backend`, ou aponte `VITE_API_TARGET` para `https://api.localhost:8787` com o wrangler local ativo.",
        );
      }
      setModal({
        kind: "info",
        title,
        description: parts.join(" "),
      });
      return;
    }

    setModal({
      kind: "info",
      title,
      description: err instanceof Error ? err.message : "Ocorreu um erro inesperado. Tente novamente.",
    });
  }, []);

  const filteredTenants = useMemo(() => {
    const text = tenantSearch.trim().toLowerCase();
    return tenants.filter((tenant) => {
      const matchesText =
        !text ||
        tenant.company_name.toLowerCase().includes(text) ||
        tenant.system_name.toLowerCase().includes(text) ||
        String((tenant as any).cpf_cnpj || "")
          .toLowerCase()
          .includes(text);
      if (!matchesText) return false;

      if (!dueDayFilter) return true;
      if (!tenant.latest_license_expires_at) return false;
      const dueDay = new Date(tenant.latest_license_expires_at).getDate();
      return dueDay === Number(dueDayFilter);
    });
  }, [dueDayFilter, tenantSearch, tenants]);

  const stats = useMemo(() => {
    const mrr = tenants.reduce((acc, tenant) => acc + Number(tenant.monthly_price || 0), 0);
    const inGrace = tenants.filter((tenant) => tenant.latest_license_status === "grace").length;
    const expired = tenants.filter(
      (tenant) => tenant.latest_license_status === "expired" || tenant.latest_license_status === "missing",
    ).length;
    const pendingPayments = payments.filter((payment) =>
      ["created", "pending", "authorized", "in_process", "in_mediation"].includes(payment.status),
    ).length;

    return {
      mrr,
      inGrace,
      expired,
      pendingPayments,
      totalTenants: tenants.length,
    };
  }, [payments, tenants]);

  const openConfirm = (
    title: string,
    description: string,
    confirmLabel: string,
    action: () => Promise<void>,
    tone: "primary" | "danger" = "primary",
  ) => {
    setModal({
      kind: "confirm",
      title,
      description,
      confirmLabel,
      action,
      tone,
    });
  };

  const closeModal = () => {
    if (modalLoading) return;
    setModal({ kind: "none" });
  };

  const changeView = (nextView: ViewKey) => {
    setView(nextView);
    setViewTransitionKey((prev) => prev + 1);
  };

  const runConfirmAction = async () => {
    if (modal.kind !== "confirm") return;
    try {
      setModalLoading(true);
      await modal.action();
      setModal({ kind: "none" });
    } catch (err: any) {
      addToast("Falha na ação", err?.message || "Não foi possível concluir.", "error");
    } finally {
      setModalLoading(false);
    }
  };

  const loadTenants = async () => {
    const data = await api<Tenant[]>("/api/tenants");
    setTenants(
      data.map((tenant) => ({
        ...tenant,
        billing_mode: tenant.billing_mode || "NORMAL",
      })),
    );
  };

  const loadPayments = async (tenantId?: string | null) => {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
    const data = await api<Payment[]>(`/api/payments${query}`);
    setPayments(data);
  };

  const loadOwnerEnvironment = async () => {
    const data = await api<OwnerEnvironment>("/api/owner/environment");
    setOwnerEnvironment(data);
  };

  const loadProfile = async () => {
    const data = await api<{ user: UserProfile }>("/api/auth/profile");
    setProfile(data.user);
    setProfileForm((prev) => ({
      ...prev,
      email: data.user.email,
    }));
    return data.user;
  };

  const refreshAll = async () => {
    if (!user) return;
    try {
      setLoading(true);
      if (user.role === "ADMIN") {
        await loadTenants();
        await loadPayments(null);
      } else {
        await Promise.all([loadTenants(), loadPayments(user.tenant_id), loadOwnerEnvironment()]);
      }
      addToast("Dados atualizados", "Painel sincronizado com sucesso.", "success");
    } catch (err: unknown) {
      openRequestErrorModal(err, "Erro ao atualizar painel");
      addToast("Erro de atualização", err instanceof Error ? err.message : "Falha ao sincronizar dados.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const boot = async () => {
      try {
        const me = await api<{ user: User }>("/api/auth/me");
        setUser(me.user);
        try {
          await loadProfile();
        } catch (profileErr) {
          openRequestErrorModal(profileErr, "Perfil indisponível");
        }
      } catch {
        setUser(null);
        setProfile(null);
      } finally {
        setCheckingSession(false);
      }
    };

    boot();
  }, [openRequestErrorModal]);

  useEffect(() => {
    if (!user) return;

    const run = async () => {
      try {
        setLoading(true);
        await loadTenants();
        if (user.role === "OWNER") {
          setView("owner_home");
          await loadOwnerEnvironment();
        } else {
          setView("overview");
          setOwnerEnvironment(null);
        }
      } catch (err: unknown) {
        openRequestErrorModal(err, "Falha ao carregar ambiente");
        addToast("Falha ao carregar tenants", err instanceof Error ? err.message : "Não foi possível carregar os tenants.", "error");
      } finally {
        setLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, openRequestErrorModal]);

  useEffect(() => {
    if (!user) return;
    const targetTenant = user.role === "OWNER" ? user.tenant_id : null;
    if (!targetTenant && user.role === "OWNER") return;

    const run = async () => {
      try {
        await loadPayments(targetTenant);
      } catch (err: unknown) {
        openRequestErrorModal(err, "Falha ao carregar pagamentos");
        addToast("Falha ao carregar dados", err instanceof Error ? err.message : "Erro ao carregar pagamentos.", "error");
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.tenant_id, openRequestErrorModal]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setLoading(true);
      await api<{ user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const me = await api<{ user: User }>("/api/auth/me");
      setUser(me.user);
      const loadedProfile = await loadProfile();
      if (me.user.password_must_change || loadedProfile.password_must_change) {
        addToast("Senha temporária", "Altere sua senha para continuar usando a conta com segurança.", "info");
        setModal({ kind: "profileSettings" });
      }
      addToast("Login realizado", "Sessão segura em cookie httpOnly ativa.", "success");
    } catch (err: any) {
      addToast("Falha no login", err.message || "Credenciais inválidas.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
    setProfile(null);
    setTenants([]);
    setPayments([]);
    setOwnerEnvironment(null);
    setView("overview");
    setProfileForm({ email: "", current_password: "", new_password: "" });
    addToast("Sessão encerrada", "Você saiu com segurança.", "info");
  };

  const handleForgotPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setRecoveryLink(null);
    setRecoveryCode(null);
    try {
      const data = await api<{ message: string; whatsapp_url?: string; request_code?: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: forgotEmail, phone: forgotPhone }),
      });
      if (data.whatsapp_url) {
        setRecoveryLink(data.whatsapp_url);
        setRecoveryCode(data.request_code || null);
        window.open(data.whatsapp_url, "_blank", "noopener,noreferrer");
      }
      addToast("Solicitação enviada", data.message, "info");
    } catch (err: any) {
      addToast("Erro na recuperação", err.message || "Não foi possível solicitar reset.", "error");
    }
  };

  const getManualRenewCopy = (billingMode: Tenant["billing_mode"]) => {
    if (billingMode === "ALWAYS_FREE") {
      return "Esta ação emite um novo token de longo prazo para o tenant sempre gratuito, mantendo a modalidade ativa sem cobrança mensal.";
    }
    if (billingMode === "FREE") {
      return "Esta ação emite uma nova licença gratuita de 30 dias para o tenant, sem cobrança via Mercado Pago.";
    }
    return "Esta ação emite uma nova licença NORMAL de 30 dias imediatamente para o tenant selecionado.";
  };

  const handleManualRenew = (tenant: Tenant) => {
    openConfirm(
      "Renovar licença manualmente",
      getManualRenewCopy(tenant.billing_mode),
      "Confirmar renovação",
      async () => {
        setLoading(true);
        try {
          await api(`/api/tenants/${tenant.id}/licenses/manual-renew`, { method: "POST" });
          await refreshAll();
          addToast("Licença renovada", "Nova licença emitida com sucesso.", "success");
        } finally {
          setLoading(false);
        }
      },
      "danger",
    );
  };

  const handleDeleteTenant = (tenantId: string, companyName: string) => {
    openConfirm(
      "Excluir tenant",
      `A empresa ${companyName} será removida com usuários, pagamentos e licenças. Esta ação não pode ser desfeita.`,
      "Excluir definitivamente",
      async () => {
        setLoading(true);
        try {
          await api(`/api/tenants/${tenantId}`, { method: "DELETE" });
          await refreshAll();
          addToast("Tenant excluído", `${companyName} removido com sucesso.`, "success");
        } finally {
          setLoading(false);
        }
      },
      "danger",
    );
  };

  const handleSchedulePrice = (tenantId: string) => {
    const raw = pricingDrafts[tenantId];
    const monthlyPrice = parseNumberInput(raw);

    if (!Number.isFinite(monthlyPrice) || monthlyPrice <= 0) {
      addToast("Preço inválido", "Informe um valor numérico positivo para agendar novo preço.", "error");
      return;
    }

    openConfirm(
      "Agendar novo valor mensal",
      `O novo valor ${formatMoney(monthlyPrice)} será aplicado na próxima renovação de licença.`,
      "Agendar preço",
      async () => {
        setLoading(true);
        try {
          await api(`/api/tenants/${tenantId}/pricing`, {
            method: "PATCH",
            body: JSON.stringify({ monthly_price: monthlyPrice }),
          });
          await refreshAll();
          addToast("Preço agendado", "Alteração registrada para o próximo ciclo.", "success");
        } finally {
          setLoading(false);
        }
      },
    );
  };

  const handleOwnerCheckout = async () => {
    const tenantId = user?.tenant_id;
    if (!tenantId) {
      addToast("Tenant inválido", "Não foi possível identificar o tenant deste usuário.", "error");
      return;
    }

    try {
      setLoading(true);
      const payload = await api<{ init_point?: string; sandbox_init_point?: string }>("/api/payments/checkout", {
        method: "POST",
        body: JSON.stringify({ tenantId }),
      });
      const checkoutUrl = payload.init_point || payload.sandbox_init_point;
      if (!checkoutUrl) {
        throw new Error("Gateway não retornou URL de pagamento.");
      }
      window.open(checkoutUrl, "_blank", "noopener,noreferrer");
      addToast("Checkout iniciado", "Abrimos a página de pagamento em nova aba.", "success");
      await Promise.all([loadPayments(tenantId), loadOwnerEnvironment()]);
    } catch (err: any) {
      addToast("Falha ao solicitar licença", err?.message || "Não foi possível iniciar o checkout.", "error");
    } finally {
      setLoading(false);
    }
  };

  const openProfileSettings = async () => {
    try {
      setModalLoading(true);
      const userProfile = await loadProfile();
      setProfileForm({
        email: userProfile.email,
        current_password: "",
        new_password: "",
      });
      setModal({ kind: "profileSettings" });
    } catch (err: unknown) {
      openRequestErrorModal(err, "Erro ao carregar perfil");
      addToast("Erro ao carregar perfil", err instanceof Error ? err.message : "Não foi possível carregar os dados do usuário.", "error");
    } finally {
      setModalLoading(false);
    }
  };

  const handleProfileUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload: Record<string, unknown> = {
      email: profileForm.email.trim().toLowerCase(),
    };

    if (profileForm.current_password || profileForm.new_password) {
      if (!profileForm.current_password || !profileForm.new_password) {
        addToast("Troca de senha incompleta", "Informe senha atual e nova senha para atualizar credenciais.", "error");
        return;
      }
      payload.current_password = profileForm.current_password;
      payload.new_password = profileForm.new_password;
    }

    try {
      setModalLoading(true);
      const data = await api<{ user: UserProfile; message: string }>("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setUser((prev) =>
        prev
          ? {
              ...prev,
              email: data.user.email,
            }
          : prev,
      );
      setProfile(data.user);
      setProfileForm({
        email: data.user.email,
        current_password: "",
        new_password: "",
      });
      addToast("Perfil atualizado", data.message, "success");
      setModal({ kind: "none" });
    } catch (err: unknown) {
      openRequestErrorModal(err, "Erro ao atualizar perfil");
      addToast("Erro ao atualizar perfil", err instanceof Error ? err.message : "Não foi possível atualizar os dados do usuário.", "error");
    } finally {
      setModalLoading(false);
    }
  };

  const handleCreateTenant = async (event: React.FormEvent) => {
    event.preventDefault();
    const billingMode = tenantForm.billing_mode;
    const monthlyPrice = billingMode === "NORMAL" ? parseNumberInput(tenantForm.monthly_price) : 0;
    const ownerEmail = tenantForm.owner_email.trim().toLowerCase();
    const ownerPhone = tenantForm.owner_phone.trim();
    const ownerPassword = tenantForm.owner_password;

    if (!tenantForm.company_name.trim() || !tenantForm.system_name.trim()) {
      addToast("Dados inválidos", "Preencha empresa e sistema corretamente.", "error");
      return;
    }

    if (billingMode === "NORMAL" && (!Number.isFinite(monthlyPrice) || monthlyPrice < 0)) {
      addToast("Mensalidade inválida", "Informe um valor válido para mensalidade.", "error");
      return;
    }

    if (billingMode === "NORMAL" && monthlyPrice <= 0) {
      addToast("Dados inválidos", "Preencha empresa, sistema e mensalidade corretamente.", "error");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!ownerEmail || !ownerPhone || !ownerPassword) {
      addToast("Onboarding incompleto", "Para criar OWNER, informe email, telefone e senha inicial.", "error");
      return;
    }
    if (!emailPattern.test(ownerEmail)) {
      addToast("Email inválido", "Informe um email válido para o OWNER.", "error");
      return;
    }
    if (ownerPassword.length < 8) {
      addToast("Senha fraca", "A senha inicial do OWNER precisa ter no mínimo 8 caracteres.", "error");
      return;
    }
    if (ownerPhone.replace(/\D/g, "").length < 10) {
      addToast("Telefone inválido", "Informe um telefone válido para recuperação de senha do OWNER.", "error");
      return;
    }

    try {
      setModalLoading(true);
      const data = await api<{ owner_user?: { id: string; email: string } | null }>("/api/tenants", {
        method: "POST",
        body: JSON.stringify({
          company_name: tenantForm.company_name.trim(),
          system_name: tenantForm.system_name.trim(),
          monthly_price: billingMode === "NORMAL" ? monthlyPrice : 0,
          billing_mode: billingMode,
          owner_email: ownerEmail || undefined,
          owner_phone: ownerPhone || undefined,
          owner_password: ownerPassword || undefined,
        }),
      });

      setTenantForm({
        company_name: "",
        system_name: "",
        monthly_price: "",
        billing_mode: "NORMAL",
        owner_email: "",
        owner_phone: "",
        owner_password: "",
      });
      setModal({ kind: "none" });
      await refreshAll();
      addToast(
        "Tenant criado",
        data.owner_user
          ? `Tenant e OWNER (${data.owner_user.email}) criados com sucesso.`
          : "Novo tenant cadastrado com sucesso.",
        "success",
      );
    } catch (err: any) {
      addToast("Falha no cadastro", err?.message || "Não foi possível criar tenant agora.", "error");
    } finally {
      setModalLoading(false);
    }
  };

  const openEditTenantModal = (tenant: Tenant) => {
    setTenantEditForm({
      company_name: tenant.company_name,
      system_name: tenant.system_name === "-" ? "" : tenant.system_name,
      monthly_price: String(tenant.monthly_price || ""),
      billing_mode: tenant.billing_mode || "NORMAL",
    });
    setModal({ kind: "editTenant", tenantId: tenant.id });
  };

  const handleEditTenant = async (event: React.FormEvent) => {
    event.preventDefault();
    if (modal.kind !== "editTenant") return;

    const companyName = tenantEditForm.company_name.trim();
    const systemName = tenantEditForm.system_name.trim();
    const billingMode = tenantEditForm.billing_mode;
    const monthlyPrice = billingMode === "NORMAL" ? parseNumberInput(tenantEditForm.monthly_price) : 0;
    if (!companyName || !systemName) {
      addToast("Campos obrigatórios", "Informe empresa e sistema para atualizar o tenant.", "error");
      return;
    }
    if (billingMode === "NORMAL" && (!Number.isFinite(monthlyPrice) || monthlyPrice < 0)) {
      addToast("Mensalidade inválida", "Informe um valor válido para mensalidade.", "error");
      return;
    }
    if (billingMode === "NORMAL" && monthlyPrice <= 0) {
      addToast("Mensalidade obrigatória", "Na modalidade NORMAL a mensalidade deve ser maior que zero.", "error");
      return;
    }

    try {
      setModalLoading(true);
      await api(`/api/tenants/${modal.tenantId}`, {
        method: "PATCH",
        body: JSON.stringify({
          company_name: companyName,
          system_name: systemName,
          billing_mode: billingMode,
          monthly_price: billingMode === "NORMAL" ? monthlyPrice : 0,
        }),
      });
      setModal({ kind: "none" });
      await refreshAll();
      addToast("Tenant atualizado", "Dados cadastrais atualizados com sucesso.", "success");
    } catch (err: any) {
      addToast("Erro ao atualizar", err?.message || "Não foi possível atualizar tenant.", "error");
    } finally {
      setModalLoading(false);
    }
  };

  const openManageOwnerModal = async (tenant: Tenant) => {
    setOwnerForm({
      loaded: false,
      ownerExists: false,
      email: "",
      phone: "",
      new_password: "",
      is_active: true,
      created_at: null,
      last_login_at: null,
    });
    setModal({ kind: "manageOwner", tenantId: tenant.id, tenantName: tenant.company_name });

    try {
      const data = await api<{ owner: OwnerProfile | null }>(`/api/tenants/${tenant.id}/owner`);
      if (!data.owner) {
        setOwnerForm({
          loaded: true,
          ownerExists: false,
          email: "",
          phone: "",
          new_password: "",
          is_active: true,
          created_at: null,
          last_login_at: null,
        });
        return;
      }

      setOwnerForm({
        loaded: true,
        ownerExists: true,
        email: data.owner.email,
        phone: data.owner.phone || "",
        new_password: "",
        is_active: data.owner.is_active,
        created_at: data.owner.created_at,
        last_login_at: data.owner.last_login_at,
      });
    } catch (err: any) {
      setModal({ kind: "none" });
      addToast("Erro ao carregar OWNER", err?.message || "Não foi possível carregar dados do OWNER.", "error");
    }
  };

  const handleOwnerUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (modal.kind !== "manageOwner") return;

    const email = ownerForm.email.trim().toLowerCase();
    const phone = ownerForm.phone.trim();
    if (!email) {
      addToast("Email obrigatório", "Informe o email do OWNER.", "error");
      return;
    }

    if (phone.replace(/\D/g, "").length < 10) {
      addToast("Telefone obrigatório", "Informe um telefone válido para recuperação de senha do OWNER.", "error");
      return;
    }

    if (!ownerForm.ownerExists && ownerForm.new_password.length < 8) {
      addToast("Senha obrigatória", "Para criar OWNER, informe senha com no mínimo 8 caracteres.", "error");
      return;
    }

    if (ownerForm.new_password && ownerForm.new_password.length < 8) {
      addToast("Senha inválida", "Nova senha precisa ter no mínimo 8 caracteres.", "error");
      return;
    }

    try {
      setModalLoading(true);
      await api(`/api/tenants/${modal.tenantId}/owner`, {
        method: "PATCH",
        body: JSON.stringify({
          email,
          phone,
          is_active: ownerForm.is_active,
          new_password: ownerForm.new_password || undefined,
        }),
      });
      setModal({ kind: "none" });
      await refreshAll();
      addToast("OWNER atualizado", "Dados de acesso do owner foram atualizados.", "success");
    } catch (err: any) {
      addToast("Erro no OWNER", err?.message || "Não foi possível atualizar owner.", "error");
    } finally {
      setModalLoading(false);
    }
  };

  const toneFromLicenseStatus = (status: Tenant["latest_license_status"]): "good" | "warn" | "danger" | "neutral" => {
    if (status === "trial") return "warn";
    if (status === "active") return "good";
    if (status === "grace") return "warn";
    if (status === "expired") return "danger";
    return "neutral";
  };

  const toneFromPaymentStatus = (status: string): "good" | "warn" | "danger" | "neutral" => {
    if (status === "approved") return "good";
    if (["pending", "created", "authorized", "in_process", "in_mediation"].includes(status)) return "warn";
    if (["rejected", "cancelled", "charged_back", "refunded"].includes(status)) return "danger";
    return "neutral";
  };

  const openTenantDetails = async (tenant: Tenant) => {
    setTenantDetails({ loading: true, payments: [], license: null });
    setModal({ kind: "tenantDetails", tenantId: tenant.id, tenantName: tenant.company_name });
    try {
      const [tenantPayments, tenantLicense] = await Promise.all([
        api<Payment[]>(`/api/payments?tenantId=${encodeURIComponent(tenant.id)}`),
        api<LicenseResponse>(`/api/licenses/${tenant.id}/current`),
      ]);
      setTenantDetails({
        loading: false,
        payments: tenantPayments,
        license: tenantLicense.license,
      });
    } catch (err: any) {
      setTenantDetails({ loading: false, payments: [], license: null });
      addToast("Falha ao carregar detalhes", err?.message || "Não foi possível carregar os detalhes do tenant.", "error");
    }
  };

  if (checkingSession) {
    return (
      <div className="screen-loader">
        <div className="loader-dot" />
        <span>Validando sessão segura...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-bg" />
        <div className="auth-shell">
          <section className="auth-panel">
            <div className="auth-tabs">
              <button className={authView === "login" ? "active" : ""} onClick={() => setAuthView("login")} type="button">
                Login
              </button>
              <button className={authView === "recovery" ? "active" : ""} onClick={() => setAuthView("recovery")} type="button">
                Recuperar senha
              </button>
            </div>

            {authView === "login" ? (
              <form className="auth-form" onSubmit={handleLogin}>
                <label>
                  Email
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </label>
                <label>
                  Senha
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                </label>
                <button className="btn btn-primary" disabled={loading} type="submit">
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </form>
            ) : (
              <div className="auth-form-stack">
                <form className="auth-form" onSubmit={handleForgotPassword}>
                  <label>
                    Email para recuperação
                    <input type="email" value={forgotEmail} onChange={(event) => setForgotEmail(event.target.value)} required />
                  </label>
                  <label>
                    Telefone cadastrado
                    <input
                      inputMode="tel"
                      placeholder="DDD + número"
                      value={forgotPhone}
                      onChange={(event) => setForgotPhone(event.target.value)}
                      required
                    />
                  </label>
                  <button className="btn btn-secondary" type="submit">
                    Iniciar recuperação
                  </button>
                </form>
                {recoveryLink ? (
                  <div className="recovery-box">
                    {recoveryCode ? <strong>Código: {recoveryCode}</strong> : null}
                    <a className="btn btn-primary" href={recoveryLink} rel="noreferrer" target="_blank">
                      Abrir WhatsApp
                    </a>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>

        <ToastStack toasts={toasts} onClose={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">
            <Sparkles size={16} />
          </div>
          <div>
            <strong>Central Premium</strong>
            <span>{user.role === "ADMIN" ? "Admin Console" : "Owner Console"}</span>
          </div>
        </div>

        <nav className="side-nav">
          {navOptions.map((option) => (
            <button
              key={option.key}
              className={view === option.key ? "active" : ""}
              onClick={() => changeView(option.key)}
              type="button"
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </nav>

        <div className="side-footer">
          <p>{user.email}</p>
          <button className="btn btn-ghost" onClick={openProfileSettings} type="button">
            <Settings size={16} />
            Perfil
          </button>
          {user.role === "OWNER" ? (
            <small className="owner-trial-note">
              Trial gratuito de 30 dias + 3 dias de carência. Após esse prazo, o acesso fica bloqueado sem renovação.
            </small>
          ) : null}
          <button
            className="btn btn-ghost"
            onClick={() =>
              openConfirm(
                "Encerrar sessão",
                "Deseja sair do painel agora?",
                "Sair",
                async () => {
                  await handleLogout();
                },
                "danger",
              )
            }
            type="button"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>{user.role === "ADMIN" ? "Painel de Operações" : "Portal do Cliente"}</h1>
            <p>
              {user.role === "ADMIN"
                ? "Cadastre tenants, acompanhe mensalidades e emita licenças mensais com rastreabilidade."
                : "Solicite renovação, acompanhe pagamentos e consulte as informações do seu sistema."}
            </p>
          </div>
          <div className="topbar-actions">
            {user.role === "ADMIN" ? (
              <button className="btn btn-primary" onClick={() => setModal({ kind: "createTenant" })} type="button">
                <PlusCircle size={16} /> Novo tenant
              </button>
            ) : (
              <button className="btn btn-primary" disabled={loading} onClick={handleOwnerCheckout} type="button">
                <CreditCard size={16} /> Solicitar licença
              </button>
            )}
            <button className="btn btn-secondary" disabled={loading} onClick={refreshAll} type="button">
              <RefreshCw className={loading ? "spin" : ""} size={16} /> Atualizar
            </button>
          </div>
        </header>

        <div key={viewTransitionKey} className="view-anim-enter">
        {loading ? (
          <section className="kpi-grid">
            {Array.from({ length: 4 }, (_, idx) => (
              <section className="panel skeleton-card" key={`kpi-skeleton-${idx}`}>
                <div className="skeleton-line skeleton-lg" />
                <div className="skeleton-line skeleton-md" />
              </section>
            ))}
          </section>
        ) : user.role === "ADMIN" ? (
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
        ) : (
          <section className="kpi-grid">
            <Card icon={<Building2 size={16} />} subtitle="Seu ambiente" title="Empresa">
              <strong className="kpi-value">{ownerEnvironment?.tenant.company_name || currentTenant?.company_name || "-"}</strong>
            </Card>
            <Card icon={<ShieldCheck size={16} />} subtitle="Estado atual da licença" title="Licença">
              <strong className="kpi-value">
                {String(ownerEnvironment?.license?.effective_status || currentTenant?.latest_license_status || "missing").toUpperCase()}
              </strong>
            </Card>
            <Card icon={<CreditCard size={16} />} subtitle="Pagamentos aprovados" title="Total pago">
              <strong className="kpi-value">{formatMoney(ownerEnvironment?.stats.approved_total_amount || 0)}</strong>
            </Card>
            <Card icon={<ReceiptText size={16} />} subtitle="Cobranças aguardando" title="Pendentes">
              <strong className="kpi-value">{ownerEnvironment?.stats.pending_payments || 0}</strong>
            </Card>
          </section>
        )}

        {user.role === "ADMIN" && view === "overview" ? (
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
        ) : null}

        {user.role === "ADMIN" && view === "tenants" ? (
          <Card title="Gestão de Tenants" subtitle="Cadastro, preço, owner e ciclo de licença" icon={<Users size={16} />}>
            <div className="tenant-filters">
              <div className="tenant-filters-grid">
                <label>
                  Buscar por nome/sistema/cpf-cnpj
                  <input
                    onChange={(event) => setTenantSearch(event.target.value)}
                    placeholder="Digite para filtrar..."
                    value={tenantSearch}
                  />
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
                  {filteredTenants.map((tenant) => (
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
                          <button className="btn btn-secondary" onClick={() => openTenantDetails(tenant)} type="button">
                            Detalhes
                          </button>
                          {user.role === "ADMIN" ? (
                            <button className="btn btn-danger-outline" onClick={() => handleManualRenew(tenant)} type="button">
                              <ShieldCheck size={15} /> Renovar
                            </button>
                          ) : null}
                          {user.role === "ADMIN" ? (
                            <button className="btn btn-ghost" onClick={() => openEditTenantModal(tenant)} type="button">
                              <Building2 size={15} /> Editar
                            </button>
                          ) : null}
                          {user.role === "ADMIN" ? (
                            <button className="btn btn-ghost" onClick={() => openManageOwnerModal(tenant)} type="button">
                              <Users size={15} /> OWNER
                            </button>
                          ) : null}
                          {user.role === "ADMIN" ? (
                            <button
                              className="btn btn-danger"
                              onClick={() => handleDeleteTenant(tenant.id, tenant.company_name)}
                              type="button"
                            >
                              <Trash2 size={15} /> Excluir
                            </button>
                          ) : null}
                        </div>
                        {user.role === "ADMIN" && tenant.billing_mode === "NORMAL" ? (
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
                            <button className="btn btn-ghost" onClick={() => handleSchedulePrice(tenant.id)} type="button">
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
        ) : null}

        {user.role === "OWNER" && view === "owner_home" ? (
          <section className="view-grid">
            <Card title="Licença atual" subtitle="Situação do acesso do seu ambiente" icon={<ShieldCheck size={16} />}>
              <div className="mini-list">
                <div>
                  <span>Status efetivo</span>
                  <strong>{String(ownerEnvironment?.license?.effective_status || currentTenant?.latest_license_status || "missing").toUpperCase()}</strong>
                </div>
                <div>
                  <span>Vencimento</span>
                  <strong>{formatDate(ownerEnvironment?.license?.expires_at || currentTenant?.latest_license_expires_at || null)}</strong>
                </div>
                <div>
                  <span>Carência até</span>
                  <strong>{formatDate(ownerEnvironment?.license?.grace_until || currentTenant?.latest_license_grace_until || null)}</strong>
                </div>
              </div>
            </Card>
            <Card title="Ações rápidas" subtitle="Operação diária do owner" icon={<CreditCard size={16} />}>
              <div className="row-actions">
                <button className="btn btn-primary" disabled={loading} onClick={handleOwnerCheckout} type="button">
                  Solicitar renovação
                </button>
                <button className="btn btn-secondary" disabled={loading} onClick={refreshAll} type="button">
                  Atualizar dados
                </button>
              </div>
            </Card>
          </section>
        ) : null}

        {user.role === "OWNER" && view === "owner_payments" ? (
          <Card title="Histórico de Pagamentos" subtitle="Últimas cobranças registradas para o seu tenant" icon={<ReceiptText size={16} />}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Payment ID</th>
                  </tr>
                </thead>
                <tbody>
                  {(ownerEnvironment?.payments || payments).map((payment) => (
                    <tr key={payment.id}>
                      <td>{formatDate(payment.created_at)}</td>
                      <td>{formatMoney(payment.amount)}</td>
                      <td>
                        <Badge label={payment.status.toUpperCase()} tone={toneFromPaymentStatus(payment.status)} />
                      </td>
                      <td>{payment.payment_id || "-"}</td>
                    </tr>
                  ))}
                  {(ownerEnvironment?.payments || payments).length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <span className="muted">Ainda não existem pagamentos para este ambiente.</span>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {user.role === "OWNER" && view === "owner_system" ? (
          <Card title="Informações do Sistema" subtitle="Dados cadastrais e modalidade do ambiente contratado" icon={<Building2 size={16} />}>
            <div className="mini-list">
              <div>
                <span>Empresa</span>
                <strong>{ownerEnvironment?.tenant.company_name || currentTenant?.company_name || "-"}</strong>
              </div>
              <div>
                <span>Sistema</span>
                <strong>{ownerEnvironment?.tenant.system_name || currentTenant?.system_name || "-"}</strong>
              </div>
              <div>
                <span>Modalidade</span>
                <strong>
                  {billingModeLabels[(ownerEnvironment?.tenant.billing_mode || currentTenant?.billing_mode || "NORMAL") as Tenant["billing_mode"]]}
                </strong>
              </div>
              <div>
                <span>Mensalidade</span>
                <strong>
                  {(ownerEnvironment?.tenant.billing_mode || currentTenant?.billing_mode) === "NORMAL"
                    ? formatMoney(ownerEnvironment?.tenant.monthly_price || currentTenant?.monthly_price || 0)
                    : "Gratuito"}
                </strong>
              </div>
              <div>
                <span>Criado em</span>
                <strong>{formatDate(ownerEnvironment?.tenant.created_at || currentTenant?.created_at || null)}</strong>
              </div>
            </div>
          </Card>
        ) : null}
        </div>
      </main>

      <ToastStack toasts={toasts} onClose={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />

      {modal.kind !== "none" ? (
        <div aria-modal="true" className="modal-overlay" role="dialog">
          <div className="modal-card">
            {modal.kind === "confirm" ? (
              <>
                <h3>{modal.title}</h3>
                <p>{modal.description}</p>
                <div className="modal-actions">
                  <button className="btn btn-ghost" onClick={closeModal} type="button">
                    Cancelar
                  </button>
                  <button
                    className={modal.tone === "danger" ? "btn btn-danger" : "btn btn-primary"}
                    disabled={modalLoading}
                    onClick={runConfirmAction}
                    type="button"
                  >
                    {modalLoading ? "Processando..." : modal.confirmLabel}
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "info" ? (
              <>
                <h3>{modal.title}</h3>
                <p>{modal.description}</p>
                <div className="modal-actions">
                  <button className="btn btn-primary" onClick={closeModal} type="button">
                    Entendi
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "tenantDetails" ? (
              <>
                <h3>Detalhes do tenant</h3>
                <p>
                  Tenant: <strong>{modal.tenantName}</strong>
                </p>
                {tenantDetails.loading ? (
                  <p>Carregando detalhes...</p>
                ) : (
                  <div className="details-grid">
                    <div className="details-block">
                      <h4>Licença atual</h4>
                      {tenantDetails.license ? (
                        <>
                          <p>
                            Status:{" "}
                            <Badge
                              label={String(tenantDetails.license.effective_status || tenantDetails.license.status).toUpperCase()}
                              tone={toneFromLicenseStatus(
                                tenantDetails.license.effective_status as Tenant["latest_license_status"],
                              )}
                            />
                          </p>
                          <p>Vencimento: {formatDate(tenantDetails.license.expires_at)}</p>
                          <p>Carência até: {formatDate(tenantDetails.license.grace_until)}</p>
                          <textarea readOnly value={tenantDetails.license.token} />
                        </>
                      ) : (
                        <p className="muted">Nenhuma licença emitida.</p>
                      )}
                    </div>
                    <div className="details-block">
                      <h4>Mensalidades</h4>
                      {tenantDetails.payments.length === 0 ? (
                        <p className="muted">Sem cobranças registradas.</p>
                      ) : (
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Data</th>
                                <th>Valor</th>
                                <th>Status</th>
                                <th>Payment ID</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tenantDetails.payments.map((payment) => (
                                <tr key={payment.id}>
                                  <td>{formatDate(payment.created_at)}</td>
                                  <td>{formatMoney(payment.amount)}</td>
                                  <td>
                                    <Badge label={payment.status.toUpperCase()} tone={toneFromPaymentStatus(payment.status)} />
                                  </td>
                                  <td>{payment.payment_id || "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="modal-actions">
                  <button className="btn btn-primary" onClick={closeModal} type="button">
                    Fechar
                  </button>
                </div>
              </>
            ) : null}

            {modal.kind === "createTenant" ? (
              <>
                <h3>Cadastrar novo tenant</h3>
                <p>Fluxo principal do admin: cadastro de cliente com mensalidade negociada.</p>
                <form className="modal-form" onSubmit={handleCreateTenant}>
                  <label>
                    Empresa
                    <input
                      onChange={(event) => setTenantForm((prev) => ({ ...prev, company_name: event.target.value }))}
                      placeholder="Ex: ACME LTDA"
                      required
                      value={tenantForm.company_name}
                    />
                  </label>
                  <label>
                    Sistema
                    <input
                      onChange={(event) => setTenantForm((prev) => ({ ...prev, system_name: event.target.value }))}
                      placeholder="Ex: ERP Premium"
                      required
                      value={tenantForm.system_name}
                    />
                  </label>
                  <label>
                    Modalidade de cobrança
                    <select
                      onChange={(event) =>
                        setTenantForm((prev) => ({
                          ...prev,
                          billing_mode: event.target.value as Tenant["billing_mode"],
                        }))
                      }
                      value={tenantForm.billing_mode}
                    >
                      <option value="ALWAYS_FREE">Sempre gratuito (token longo prazo)</option>
                      <option value="FREE">Gratuito (30 + 3 dias)</option>
                      <option value="NORMAL">Normal (mensal Mercado Pago)</option>
                    </select>
                  </label>
                  <label>
                    Mensalidade (R$)
                    <input
                      disabled={tenantForm.billing_mode !== "NORMAL"}
                      inputMode="decimal"
                      onChange={(event) => setTenantForm((prev) => ({ ...prev, monthly_price: event.target.value }))}
                      placeholder={tenantForm.billing_mode === "NORMAL" ? "Ex: 150.00" : "Automático: gratuito"}
                      required={tenantForm.billing_mode === "NORMAL"}
                      value={tenantForm.monthly_price}
                    />
                  </label>
                  <label>
                    Email do OWNER
                    <input
                      onChange={(event) => setTenantForm((prev) => ({ ...prev, owner_email: event.target.value }))}
                      placeholder="cliente@empresa.com"
                      required
                      type="email"
                      value={tenantForm.owner_email}
                    />
                  </label>
                  <label>
                    Telefone do OWNER
                    <input
                      inputMode="tel"
                      onChange={(event) => setTenantForm((prev) => ({ ...prev, owner_phone: event.target.value }))}
                      placeholder="DDD + número"
                      required
                      value={tenantForm.owner_phone}
                    />
                  </label>
                  <label>
                    Senha inicial do OWNER
                    <input
                      minLength={8}
                      onChange={(event) => setTenantForm((prev) => ({ ...prev, owner_password: event.target.value }))}
                      placeholder="Mínimo 8 caracteres"
                      required
                      type="password"
                      value={tenantForm.owner_password}
                    />
                  </label>
                  <div className="modal-actions">
                    <button className="btn btn-ghost" onClick={closeModal} type="button">
                      Cancelar
                    </button>
                    <button className="btn btn-primary" disabled={modalLoading} type="submit">
                      {modalLoading ? "Salvando..." : "Salvar tenant"}
                    </button>
                  </div>
                </form>
              </>
            ) : null}

            {modal.kind === "editTenant" ? (
              <>
                <h3>Editar tenant</h3>
                <p>Ajuste os dados cadastrais da empresa e do sistema vinculado.</p>
                <form className="modal-form" onSubmit={handleEditTenant}>
                  <label>
                    Empresa
                    <input
                      onChange={(event) => setTenantEditForm((prev) => ({ ...prev, company_name: event.target.value }))}
                      placeholder="Razão social"
                      required
                      value={tenantEditForm.company_name}
                    />
                  </label>
                  <label>
                    Sistema
                    <input
                      onChange={(event) => setTenantEditForm((prev) => ({ ...prev, system_name: event.target.value }))}
                      placeholder="Nome comercial do sistema"
                      required
                      value={tenantEditForm.system_name}
                    />
                  </label>
                  <label>
                    Modalidade de cobrança
                    <select
                      onChange={(event) =>
                        setTenantEditForm((prev) => ({
                          ...prev,
                          billing_mode: event.target.value as Tenant["billing_mode"],
                        }))
                      }
                      value={tenantEditForm.billing_mode}
                    >
                      <option value="ALWAYS_FREE">Sempre gratuito (token longo prazo)</option>
                      <option value="FREE">Gratuito (30 + 3 dias)</option>
                      <option value="NORMAL">Normal (mensal Mercado Pago)</option>
                    </select>
                  </label>
                  <label>
                    Mensalidade (R$)
                    <input
                      disabled={tenantEditForm.billing_mode !== "NORMAL"}
                      inputMode="decimal"
                      onChange={(event) => setTenantEditForm((prev) => ({ ...prev, monthly_price: event.target.value }))}
                      placeholder={tenantEditForm.billing_mode === "NORMAL" ? "Ex: 150.00" : "Automático: gratuito"}
                      required={tenantEditForm.billing_mode === "NORMAL"}
                      value={tenantEditForm.monthly_price}
                    />
                  </label>
                  <div className="modal-actions">
                    <button className="btn btn-ghost" onClick={closeModal} type="button">
                      Cancelar
                    </button>
                    <button className="btn btn-primary" disabled={modalLoading} type="submit">
                      {modalLoading ? "Salvando..." : "Salvar alterações"}
                    </button>
                  </div>
                </form>
              </>
            ) : null}

            {modal.kind === "manageOwner" ? (
              <>
                <h3>Gerir OWNER</h3>
                <p>
                  Tenant: <strong>{modal.tenantName}</strong>
                </p>
                {!ownerForm.loaded ? (
                  <p>Carregando dados do owner...</p>
                ) : (
                  <form className="modal-form" onSubmit={handleOwnerUpdate}>
                    <label>
                      Email do OWNER
                      <input
                        onChange={(event) => setOwnerForm((prev) => ({ ...prev, email: event.target.value }))}
                        placeholder="owner@empresa.com"
                        required
                        type="email"
                        value={ownerForm.email}
                      />
                    </label>
                    <label>
                      Telefone do OWNER
                      <input
                        inputMode="tel"
                        onChange={(event) => setOwnerForm((prev) => ({ ...prev, phone: event.target.value }))}
                        placeholder="DDD + número"
                        required
                        value={ownerForm.phone}
                      />
                    </label>
                    <label>
                      {ownerForm.ownerExists ? "Nova senha (opcional)" : "Senha inicial do OWNER"}
                      <input
                        minLength={8}
                        onChange={(event) => setOwnerForm((prev) => ({ ...prev, new_password: event.target.value }))}
                        placeholder={ownerForm.ownerExists ? "Preencha somente para resetar" : "Mínimo 8 caracteres"}
                        type="password"
                        value={ownerForm.new_password}
                      />
                    </label>
                    <label className="inline-checkbox">
                      <input
                        checked={ownerForm.is_active}
                        onChange={(event) => setOwnerForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                        type="checkbox"
                      />
                      Usuário OWNER ativo
                    </label>
                    {ownerForm.ownerExists ? (
                      <div className="owner-meta">
                        <span>Criado em: {formatDate(ownerForm.created_at)}</span>
                        <span>Último login: {formatDate(ownerForm.last_login_at)}</span>
                      </div>
                    ) : (
                      <p className="muted">Nenhum OWNER encontrado para este tenant. Salvar irá criar o primeiro OWNER.</p>
                    )}
                    <div className="modal-actions">
                      <button className="btn btn-ghost" onClick={closeModal} type="button">
                        Cancelar
                      </button>
                      <button className="btn btn-primary" disabled={modalLoading} type="submit">
                        {modalLoading ? "Salvando..." : ownerForm.ownerExists ? "Atualizar OWNER" : "Criar OWNER"}
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : null}

            {modal.kind === "profileSettings" ? (
              <>
                <h3>Configurações da conta</h3>
                <p>Atualize seu email de acesso, altere a senha e veja os dados desta conta.</p>
                <div className="owner-meta">
                  <span>ID: {profile?.id || user.id}</span>
                  <span>Perfil: {profile?.role || user.role}</span>
                  <span>Status: {profile?.is_active ? "Ativo" : "Inativo"}</span>
                  <span>Criado em: {formatDate(profile?.created_at || null)}</span>
                  <span>Último login: {formatDate(profile?.last_login_at || null)}</span>
                </div>
                <form className="modal-form" onSubmit={handleProfileUpdate}>
                  <label>
                    Email de acesso
                    <input
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
                      placeholder="seu.email@dominio.com"
                      required
                      type="email"
                      value={profileForm.email}
                    />
                  </label>
                  <label>
                    Senha atual (opcional)
                    <input
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, current_password: event.target.value }))}
                      placeholder="Preencha para trocar senha"
                      type="password"
                      value={profileForm.current_password}
                    />
                  </label>
                  <label>
                    Nova senha (opcional)
                    <input
                      minLength={8}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, new_password: event.target.value }))}
                      placeholder="Mínimo 8 caracteres"
                      type="password"
                      value={profileForm.new_password}
                    />
                  </label>
                  <div className="modal-actions">
                    <button className="btn btn-ghost" onClick={closeModal} type="button">
                      Cancelar
                    </button>
                    <button className="btn btn-primary" disabled={modalLoading} type="submit">
                      {modalLoading ? "Salvando..." : "Salvar perfil"}
                    </button>
                  </div>
                </form>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ToastStack({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
  return (
    <div className="toast-stack" role="status">
      {toasts.map((toast) => (
        <article className={`toast ${toastToneToClass[toast.tone]}`} key={toast.id}>
          <div>
            <strong>{toast.title}</strong>
            <p>{toast.description}</p>
          </div>
          <button aria-label="Fechar notificação" onClick={() => onClose(toast.id)} type="button">
            ×
          </button>
        </article>
      ))}
    </div>
  );
}
