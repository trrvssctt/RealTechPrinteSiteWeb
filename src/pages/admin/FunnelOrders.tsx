// Admin · commandes d'un funnel et confirmation des paiements (/admin/funnels/:id/commandes)
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, MessageCircle, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  adminFunnelApi, fmtPrice, whatsappLink, METHOD_LABELS, ORDER_STATUS_LABELS, ORDER_STATUS_STYLES,
  type AdminFunnel, type FunnelOrderRow, type FunnelOrderStatus, type PaymentSettings,
} from '@/lib/funnels';

type Filter = 'todo' | 'cod' | 'not_received' | 'paid' | 'closed' | 'all';
const FILTERS: Array<{ key: Filter; label: string; match: (s: FunnelOrderStatus) => boolean }> = [
  { key: 'todo', label: 'À confirmer', match: (s) => s === 'declared' || s === 'confirming' },
  { key: 'cod', label: 'À livrer (COD)', match: (s) => s === 'cod_pending' },
  { key: 'not_received', label: 'Non reçus', match: (s) => s === 'not_received' },
  { key: 'paid', label: 'Payées', match: (s) => s === 'paid' },
  { key: 'closed', label: 'Annulées / expirées', match: (s) => s === 'cancelled' || s === 'expired' },
  { key: 'all', label: 'Toutes', match: (s) => s !== 'reserved' },
];

const dt = (d: string | null) => (d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

export default function FunnelOrders() {
  const { id = '' } = useParams();
  const [funnel, setFunnel] = useState<AdminFunnel | null>(null);
  const [orders, setOrders] = useState<FunnelOrderRow[] | null>(null);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [filter, setFilter] = useState<Filter>('todo');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    adminFunnelApi.orders(id).then(setOrders).catch((e) => toast.error(e.message));
  }, [id]);

  useEffect(() => {
    adminFunnelApi.get(id).then(setFunnel).catch((e) => toast.error(e.message));
    adminFunnelApi.settings().then(setSettings).catch(() => {});
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 30000);
    return () => clearInterval(t);
  }, [id, load]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, (orders || []).filter((o) => f.match(o.status)).length])), [orders]);
  // Par défaut, on ouvre l'onglet qui a du travail
  useEffect(() => {
    if (orders && filter === 'todo' && counts.todo === 0) setFilter(counts.cod ? 'cod' : 'all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const shown = (orders || []).filter((o) => FILTERS.find((f) => f.key === filter)!.match(o.status));
  const selected = orders?.find((o) => o.id === selectedId) || null;
  useEffect(() => {
    setDelivered(selected?.payment_method === 'cod');
    setCancelling(false);
    setCancelReason('');
  }, [selectedId, selected?.payment_method]);

  const act = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const actionable = selected && ['declared', 'cod_pending', 'not_received'].includes(selected.status);
  const account = selected?.payment_method && selected.payment_method !== 'cod' ? settings?.[selected.payment_method] : null;

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden grid lg:grid-cols-[1fr_380px] min-h-[600px]">
      <div className="p-5 space-y-5 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to="/admin/funnels" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />{funnel?.title || 'Funnels'}</Link>
            <h1 className="text-2xl font-bold">Commandes · {counts.all ?? 0}</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1.5" />Actualiser</Button>
            {funnel && <Button variant="outline" size="sm" asChild><Link to={`/admin/funnels/${funnel.id}`}>Modifier le funnel</Link></Button>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1 text-sm font-medium ${filter === f.key
                ? (f.key === 'todo' ? 'bg-orange-500 border-orange-500 text-white' : 'bg-blue-600 border-blue-600 text-white')
                : 'bg-white hover:bg-muted'}`}>
              {f.label} · {counts[f.key] || 0}
            </button>
          ))}
        </div>

        <div className="rounded-lg border overflow-x-auto">
          {orders === null ? (
            <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : shown.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Aucune commande ici.</p>
          ) : (
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Réf.</th>
                  <th className="text-left font-semibold px-4 py-3">Client</th>
                  <th className="text-left font-semibold px-4 py-3">Paiement</th>
                  <th className="text-right font-semibold px-4 py-3">Montant</th>
                  <th className="text-left font-semibold px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((o) => (
                  <tr key={o.id} onClick={() => setSelectedId(o.id)}
                    className={`cursor-pointer ${o.id === selectedId ? 'bg-blue-50/60 shadow-[inset_3px_0_0_#2563eb]' : 'hover:bg-muted/30'}`}>
                    <td className="px-4 py-3 font-mono">{o.ref}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{o.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{o.customer_phone}{o.address ? ` · ${o.address}` : o.reception === 'pickup' ? ' · Retrait' : ''}</p>
                    </td>
                    <td className="px-4 py-3">{o.payment_method ? METHOD_LABELS[o.payment_method] : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-mono">{fmtPrice(o.total_amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${ORDER_STATUS_STYLES[o.status]}`}>
                        {ORDER_STATUS_LABELS[o.status]}{o.status === 'paid' && o.invoice_number ? ` · ${o.invoice_number}` : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Détail */}
      <aside className="border-t lg:border-t-0 lg:border-l bg-muted/20 p-5 flex flex-col gap-4">
        {!selected ? (
          <p className="m-auto text-sm text-muted-foreground text-center">Sélectionnez une commande pour la confirmer.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-mono">{selected.ref}</h2>
              <button type="button" onClick={() => setSelectedId(null)} aria-label="Fermer" className="p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>

            {(selected.status === 'declared' || selected.status === 'not_received') && account && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm">
                <p className="font-semibold text-orange-700">À vérifier dans l'app {METHOD_LABELS[selected.payment_method!]}</p>
                <p className="mt-1 text-orange-900">Réception de <b>{fmtPrice(selected.total_amount)}</b> sur le <b>{account.number}</b> avec le motif <b>{selected.ref}</b>.</p>
              </div>
            )}
            {selected.status === 'cod_pending' && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                Paiement à la livraison : confirmez une fois <b>{fmtPrice(selected.total_amount)}</b> encaissés par le livreur.
              </div>
            )}

            <dl className="text-sm divide-y rounded-lg border bg-white">
              {[
                ['Produit', `${selected.variant_label} × ${selected.quantity}`],
                ['Client', selected.customer_name],
                ['WhatsApp', selected.customer_phone],
                ['Email', selected.customer_email || '—'],
                [selected.reception === 'pickup' ? 'Retrait' : 'Livraison', selected.reception === 'pickup' ? "À l'atelier" : selected.address],
                ['Paiement', selected.payment_method ? METHOD_LABELS[selected.payment_method] : '—'],
                ['Déclaré', dt(selected.declared_at)],
                ...(selected.status === 'paid' ? [['Confirmé', `${dt(selected.confirmed_at)}${selected.confirmed_by_name ? ` · ${selected.confirmed_by_name}` : ''}`]] : []),
                ...(selected.cancel_reason ? [['Motif', selected.cancel_reason]] : []),
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-4 px-3 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-right">{v}</dd></div>
              ))}
            </dl>

            {selected.status === 'paid' && (
              <div className="flex flex-wrap gap-3 text-sm">
                <Link to="/admin/orders" className="font-semibold text-blue-600 hover:underline">Voir dans Commandes</Link>
                <Link to="/admin/invoices" className="font-semibold text-blue-600 hover:underline">Facture {selected.invoice_number}</Link>
              </div>
            )}
            {whatsappLink(selected.customer_phone) && (
              <a href={whatsappLink(selected.customer_phone, `Bonjour ${selected.customer_name.split(' ')[0]}, au sujet de votre commande ${selected.ref}`)!}
                target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline">
                <MessageCircle className="h-4 w-4" />Écrire au client sur WhatsApp
              </a>
            )}

            {actionable && (
              <>
                <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                  Confirmer crée la commande dans <b>Commandes</b> avec le versement, émet la facture payée dans <b>Factures</b> et envoie la confirmation au client.
                </p>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={delivered} onCheckedChange={(c) => setDelivered(!!c)} className="mt-0.5" />
                  <span>Déjà livré au client <span className="text-muted-foreground">(le stock est déduit maintenant ; sinon, à la livraison via « Finaliser »)</span></span>
                </label>

                {cancelling ? (
                  <div className="space-y-2">
                    <Textarea rows={2} placeholder="Motif (envoyé au client)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setCancelling(false)}>Retour</Button>
                      <Button variant="destructive" className="flex-1" disabled={busy || !cancelReason.trim()}
                        onClick={() => act(() => adminFunnelApi.cancel(selected.id, cancelReason.trim()), 'Commande annulée, stock promo libéré')}>Annuler la commande</Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-auto space-y-2">
                    <Button className="w-full" disabled={busy} onClick={() => act(() => adminFunnelApi.confirm(selected.id, delivered), 'Paiement confirmé : commande et facture créées')}>
                      {busy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                      {selected.payment_method === 'cod' ? 'Encaissé, confirmer' : 'Paiement reçu, confirmer'}
                    </Button>
                    <div className="flex gap-2">
                      {selected.status !== 'not_received' && selected.payment_method !== 'cod' && (
                        <Button variant="outline" className="flex-1" disabled={busy}
                          onClick={() => act(() => adminFunnelApi.notReceived(selected.id), 'Client relancé')}>Non reçu (relancer)</Button>
                      )}
                      <Button variant="outline" className="flex-1 text-red-600" disabled={busy} onClick={() => setCancelling(true)}>Annuler</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
