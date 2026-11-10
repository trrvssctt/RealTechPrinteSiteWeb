// Funnels promo : types, appels API et libellés partagés (pages publiques et admin)
import { apiFetch } from '@/lib/api';

export type FunnelState = 'draft' | 'scheduled' | 'online' | 'ended';
export type PaymentMethod = 'wave' | 'orange_money' | 'cod';
export type FunnelOrderStatus =
  | 'reserved' | 'declared' | 'cod_pending' | 'not_received' | 'confirming' | 'paid' | 'cancelled' | 'expired';

export interface PublicPaymentMethod {
  key: PaymentMethod;
  label: string;
  number?: string;
  holder?: string;
  zones?: string;
  max_amount?: number;
}

export interface PublicFunnel {
  slug: string;
  title: string;
  description: string;
  bullets: string[];
  category: string | null;
  images: string[];
  regular_price: number;
  starts_at: string | null;
  ends_at: string | null;
  state: FunnelState;
  max_qty: number;
  variants: Array<{ id: string; label: string; price: number; stock: number; available: number }>;
  payment: { methods: PublicPaymentMethod[]; reservation_minutes: number };
  whatsapp: string | null;
}

export interface FunnelVariant {
  id?: string;
  label: string;
  price: number;
  stock: number;
  is_active: boolean;
  held?: number;
  available?: number;
}

export interface AdminFunnel {
  id: string;
  slug: string;
  title: string;
  product_id: string;
  product_name: string;
  product_sku: string | null;
  product_stock: number;
  regular_price: number;
  promo_price: number | null;
  promo_stock: number;
  held: number;
  image: string | null;
  image_url: string | null;
  images: string[];
  description: string | null;
  bullets: string[];
  starts_at: string | null;
  ends_at: string | null;
  is_published: boolean;
  max_qty: number;
  payment_methods: Record<PaymentMethod, boolean>;
  confirmation_message: string | null;
  visits: number;
  orders_count: number;
  to_process: number;
  paid_count: number;
  revenue: number;
  state: FunnelState;
  variants?: FunnelVariant[];
}

export interface FunnelOrderRow {
  id: string;
  ref: string;
  status: FunnelOrderStatus;
  variant_label: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  reception: 'delivery' | 'pickup';
  address: string | null;
  payment_method: PaymentMethod | null;
  expires_at: string | null;
  declared_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  order_id: string | null;
  invoice_id: string | null;
  invoice_number: string | null;
  confirmed_by_name: string | null;
}

export interface PaymentSettings {
  wave: { enabled: boolean; number: string; holder: string };
  orange_money: { enabled: boolean; number: string; holder: string };
  cod: { enabled: boolean; zones: string; max_amount: number };
  reservation_minutes: number;
  team_email: string;
  team_whatsapp: string;
}

export const STATE_LABELS: Record<FunnelState, string> = {
  draft: 'Brouillon',
  scheduled: 'Programmé',
  online: 'En ligne',
  ended: 'Terminé',
};

export const STATE_STYLES: Record<FunnelState, string> = {
  draft: 'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-50 text-blue-700',
  online: 'bg-emerald-50 text-emerald-700',
  ended: 'bg-gray-100 text-gray-500',
};

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  cod: 'À la livraison',
};

export const METHOD_DOTS: Record<PaymentMethod, string> = {
  wave: 'bg-sky-500',
  orange_money: 'bg-orange-500',
  cod: 'bg-emerald-500',
};

export const ORDER_STATUS_LABELS: Record<FunnelOrderStatus, string> = {
  reserved: 'Réservée',
  declared: 'Paiement déclaré',
  cod_pending: 'À livrer · encaisser',
  not_received: 'Non reçu · relancé',
  confirming: 'Confirmation…',
  paid: 'Payée',
  cancelled: 'Annulée',
  expired: 'Expirée',
};

export const ORDER_STATUS_STYLES: Record<FunnelOrderStatus, string> = {
  reserved: 'bg-gray-100 text-gray-600',
  declared: 'bg-orange-100 text-orange-700',
  cod_pending: 'bg-blue-50 text-blue-700',
  not_received: 'bg-rose-50 text-rose-700',
  confirming: 'bg-gray-100 text-gray-600',
  paid: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
  expired: 'bg-gray-100 text-gray-400',
};

export const fmtPrice = (n: number | null | undefined) =>
  `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(n) || 0)} F`;

export const discountPct = (regular: number, promo: number) =>
  regular > 0 && promo < regular ? Math.round((1 - promo / regular) * 100) : 0;

// Lien WhatsApp (wa.me) à partir d'un numéro sénégalais saisi librement
export function whatsappLink(phone: string | null | undefined, text = '') {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 9) digits = `221${digits}`;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

async function readJson<T>(resp: Response): Promise<T> {
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error((body as any).error || `Erreur ${resp.status}`);
  return body as T;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

// ── Public ──
export const funnelApi = {
  get: async (slug: string) => (await readJson<{ data: PublicFunnel }>(await apiFetch(`/api/funnels/${encodeURIComponent(slug)}`))).data,
  visit: (slug: string) => apiFetch(`/api/funnels/${encodeURIComponent(slug)}/visit`, json('POST')).catch(() => undefined),
  reserve: async (slug: string, body: Record<string, unknown>) =>
    (await readJson<{ data: { ref: string; token: string; expires_at: string; total_amount: number } }>(
      await apiFetch(`/api/funnels/${encodeURIComponent(slug)}/orders`, json('POST', body)))).data,
  order: async (token: string) => (await readJson<{ data: any }>(await apiFetch(`/api/funnels/orders/${encodeURIComponent(token)}`))).data,
  declare: async (token: string, method: PaymentMethod) =>
    (await readJson<{ data: { status: FunnelOrderStatus } }>(
      await apiFetch(`/api/funnels/orders/${encodeURIComponent(token)}/declare`, json('POST', { method })))).data,
};

// ── Admin ──
export const adminFunnelApi = {
  list: async () => (await readJson<{ data: AdminFunnel[] }>(await apiFetch('/api/admin/funnels'))).data,
  summary: async () => (await readJson<{ data: { online: number; orders_30d: number; to_process: number; revenue_30d: number } }>(
    await apiFetch('/api/admin/funnels/summary'))).data,
  get: async (id: string) => (await readJson<{ data: AdminFunnel }>(await apiFetch(`/api/admin/funnels/${id}`))).data,
  save: async (id: string | null, body: Record<string, unknown>) =>
    (await readJson<{ data: AdminFunnel }>(await apiFetch(id ? `/api/admin/funnels/${id}` : '/api/admin/funnels', json(id ? 'PUT' : 'POST', body)))).data,
  remove: async (id: string) => {
    const resp = await apiFetch(`/api/admin/funnels/${id}`, { method: 'DELETE' });
    if (!resp.ok) await readJson(resp);
  },
  settings: async () => (await readJson<{ data: PaymentSettings }>(await apiFetch('/api/admin/funnels/settings/payment'))).data,
  saveSettings: async (body: PaymentSettings) =>
    (await readJson<{ data: PaymentSettings }>(await apiFetch('/api/admin/funnels/settings/payment', json('PUT', body)))).data,
  orders: async (id: string) => (await readJson<{ data: FunnelOrderRow[] }>(await apiFetch(`/api/admin/funnels/${id}/orders`))).data,
  confirm: async (orderId: string, delivered: boolean) =>
    (await readJson(await apiFetch(`/api/admin/funnels/orders/${orderId}/confirm`, json('POST', { delivered })))),
  notReceived: async (orderId: string) => (await readJson(await apiFetch(`/api/admin/funnels/orders/${orderId}/not-received`, json('POST')))),
  cancel: async (orderId: string, reason: string) =>
    (await readJson(await apiFetch(`/api/admin/funnels/orders/${orderId}/cancel`, json('POST', { reason })))),
};
