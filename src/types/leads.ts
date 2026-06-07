export const PROSPECTING_MODES = ["complete"] as const;

export type ProspectingMode = (typeof PROSPECTING_MODES)[number];
export type StoredProspectingMode = "economic" | "basic" | "complete";

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

export const prospectingModeLabels: Record<StoredProspectingMode, string> = {
  economic: "Econômico legado",
  basic: "Básico legado",
  complete: "Completo protegido",
};

export const prospectingModeDescriptions: Record<ProspectingMode, string> = {
  complete:
    "Busca telefone, site e avaliações com limite interno conservador de 800 eventos mensais.",
};
