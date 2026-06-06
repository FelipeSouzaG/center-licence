import type { Tenant } from "../types/domain";

export const billingModeLabels: Record<Tenant["billing_mode"], string> = {
  ALWAYS_FREE: "Sempre gratuito",
  FREE: "Gratuito (30+3)",
  NORMAL: "Normal (cobrança mensal)",
};
