export const formatMoney = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

export const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString("pt-BR") : "-");
