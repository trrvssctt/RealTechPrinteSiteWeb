import { eachDayOfInterval, eachMonthOfInterval, format, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";
import { fr } from "date-fns/locale";

export type TimeFilter = "today" | "7days" | "30days" | "month" | "all";

export interface Period {
  start: Date;
  end: Date;
  // Période de comparaison (aucune pour « Tout »)
  previous: { start: Date; end: Date } | null;
}

// Période sélectionnée et période précédente de même durée (à heure équivalente pour le jour et le mois)
export function getPeriod(filter: TimeFilter, now = new Date()): Period {
  const rolling = (days: number): Period => {
    const start = startOfDay(subDays(now, days - 1));
    return { start, end: now, previous: { start: subDays(start, days), end: start } };
  };
  switch (filter) {
    case "today": {
      const start = startOfDay(now);
      return { start, end: now, previous: { start: subDays(start, 1), end: subDays(now, 1) } };
    }
    case "7days":
      return rolling(7);
    case "30days":
      return rolling(30);
    case "month": {
      const start = startOfMonth(now);
      return { start, end: now, previous: { start: subMonths(start, 1), end: subMonths(now, 1) } };
    }
    default:
      return { start: new Date(0), end: now, previous: null };
  }
}

export const orderDate = (o: any): Date => new Date(o.placed_at || o.created_at);

// Même règle que les rapports : le CA compte les ventes terminées ou en cours
export const isCountedSale = (o: any): boolean => o.status === "completed" || o.status === "in_progress";

// Commande passée par un visiteur du site (et non saisie par le personnel)
export const isSiteOrder = (o: any): boolean => o.metadata?.admin_created !== true;

export const sumRevenue = (orders: any[]): number =>
  orders.filter(isCountedSale).reduce((s, o) => s + Number(o.total_amount || 0), 0);

const lineCategory = (item: any): string => {
  if (item.service_id) return "Services";
  if (item.product_id) return item.category_name || "Non catégorisé";
  return "Lignes libres";
};

// CA par catégorie : remise répartie au prorata des lignes, pour que le total égale le CA de la période
export function categoryBreakdown(orders: any[]): Array<{ name: string; value: number }> {
  const totals = new Map<string, number>();
  const add = (name: string, amount: number) => totals.set(name, (totals.get(name) || 0) + amount);
  orders.filter(isCountedSale).forEach((order) => {
    const orderTotal = Number(order.total_amount || 0);
    const lines = (order.items || []).map((it: any) => ({
      category: lineCategory(it),
      amount: Number(it.total) || Number(it.unit_price || 0) * Number(it.quantity || 1),
    }));
    const linesSum = lines.reduce((s: number, l: any) => s + l.amount, 0);
    if (linesSum <= 0) {
      add("Non catégorisé", orderTotal);
      return;
    }
    lines.forEach((l: any) => add(l.category, l.amount * (orderTotal / linesSum)));
  });
  return Array.from(totals.entries())
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
}

// Les n premières catégories, le reste regroupé dans « Autres » (les pourcentages restent justes)
export function topCategories(categories: Array<{ name: string; value: number }>, n = 5) {
  if (categories.length <= n) return categories;
  const others = categories.slice(n).reduce((s, c) => s + c.value, 0);
  return [...categories.slice(0, n), { name: "Autres", value: others }];
}

// Séries des graphiques, jours sans vente inclus (par mois pour « Tout »)
export function buildSeries(orders: any[], period: Period, byMonth: boolean) {
  const keyOf = (d: Date) => format(d, byMonth ? "yyyy-MM" : "yyyy-MM-dd");
  let start = period.start;
  if (byMonth) {
    const earliest = orders.reduce((min, o) => Math.min(min, orderDate(o).getTime()), period.end.getTime());
    start = new Date(earliest);
  }
  const buckets = byMonth
    ? eachMonthOfInterval({ start, end: period.end })
    : eachDayOfInterval({ start, end: period.end });
  const revenue = new Map<string, number>();
  const counts = new Map<string, number>();
  orders.forEach((o) => {
    const key = keyOf(orderDate(o));
    counts.set(key, (counts.get(key) || 0) + 1);
    if (isCountedSale(o)) revenue.set(key, (revenue.get(key) || 0) + Number(o.total_amount || 0));
  });
  const label = (d: Date) => format(d, byMonth ? "MMM yy" : "dd/MM", { locale: fr });
  return {
    revenue: buckets.map((d) => ({ date: label(d), montant: Math.round(revenue.get(keyOf(d)) || 0) })),
    orders: buckets.map((d) => ({ date: label(d), commandes: counts.get(keyOf(d)) || 0 })),
  };
}
