export const PROSPECTING_MODES = ["economic", "basic", "complete"] as const;

export type ProspectingMode = (typeof PROSPECTING_MODES)[number];

export type GooglePlacesUsage = {
  mode: ProspectingMode;
  label: string;
  description: string;
  usageGroup: string;
  dailyUsed: number;
  dailyLimit: number;
  dailyRemaining: number;
  monthlyUsed: number;
  monthlyLimit: number;
  monthlyRemaining: number;
  blocked: boolean;
};

export const prospectingModeLabels: Record<ProspectingMode, string> = {
  economic: "Econômico",
  basic: "Básico",
  complete: "Completo",
};

export const prospectingModeDescriptions: Record<ProspectingMode, string> = {
  economic: "Busca candidatos com dados mínimos. Ideal para varredura inicial.",
  basic: "Busca nome comercial, endereço e link do Google Maps. Use para qualificar melhor os leads.",
  complete: "Busca telefone, site e avaliações. Use somente nos melhores leads para preservar a cota gratuita.",
};
