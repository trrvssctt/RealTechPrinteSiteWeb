// Lien privé d'une commande promo : /promo/commande/:token
// Réservée → paiement (Wave / Orange Money / à la livraison) ; ensuite confirmation, suivi et facture.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Copy, Download, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { funnelApi, fmtPrice, whatsappLink, METHOD_DOTS, type PaymentMethod, type PublicPaymentMethod } from '@/lib/funnels';
import { buildInvoiceHTML, type Invoice } from '@/lib/invoiceTemplate';
import { downloadInvoicePdf } from '@/lib/invoicePdf';
import { PromoHeader, StepBar, StepTrail, primaryBtn, useCountdown, formatMinutes } from '@/components/promo/PromoShared';

// Aperçu A4 de la facture, mis à l'échelle de son conteneur
function InvoicePreview({ invoice }: { invoice: Invoice }) {
  const html = useMemo(() => buildInvoiceHTML(invoice), [invoice]);
  const [width, setWidth] = useState(0);
  const ref = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
  }, []);
  const scale = width ? width / 794 : 0.5;
  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-hidden rounded-lg border bg-white shadow-sm" style={{ height: 1123 * scale }}>
      <iframe title="Facture" srcDoc={html} className="absolute top-0 left-0 origin-top-left pointer-events-none" style={{ width: 794, height: 1123, transform: `scale(${scale})`, border: 0 }} />
    </div>
  );
}

function PaymentStep({ order, onDeclared }: { order: any; onDeclared: () => void }) {
  const methods: PublicPaymentMethod[] = order.payment.methods.filter(
    (m: PublicPaymentMethod) => m.key !== 'cod' || !m.max_amount || order.total_amount <= m.max_amount
  );
  const [method, setMethod] = useState<PaymentMethod | null>(order.payment_method && methods.some((m) => m.key === order.payment_method) ? order.payment_method : methods[0]?.key ?? null);
  const [sending, setSending] = useState(false);
  const left = useCountdown(order.status === 'reserved' ? order.expires_at : null);
  const selected = methods.find((m) => m.key === method);

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text.replace(/\s/g, '')); toast.success('Numéro copié'); } catch { /* presse-papiers indisponible */ }
  };

  const declare = async () => {
    if (!method) return;
    setSending(true);
    try {
      await funnelApi.declare(order.token, method);
      onDeclared();
    } catch (e: any) {
      toast.error(e.message);
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {order.status === 'not_received' && (
        <p className="rounded-xl bg-rose-50 text-rose-800 px-4 py-3 text-sm">
          Nous n'avons pas encore trouvé votre paiement. Vérifiez le numéro et le motif <b>{order.ref}</b>, puis confirmez à nouveau.
        </p>
      )}
      <div className="text-center space-y-1">
        <p className="text-sm text-gray-500">Montant à payer</p>
        <p className="text-4xl font-bold tabular-nums">{fmtPrice(order.total_amount)}</p>
        {left && left.ms > 0 && <p className="text-sm font-semibold text-red-600">Commande réservée encore {formatMinutes(left)}</p>}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Comment voulez-vous payer ?</p>
        {methods.map((m) => (
          <button key={m.key} type="button" onClick={() => setMethod(m.key)}
            className={`w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left font-semibold ${method === m.key ? 'border-[#0D5FD9] bg-blue-50/40' : 'border-gray-200 bg-white'}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${METHOD_DOTS[m.key]}`} />{m.label}
          </button>
        ))}
        {methods.length === 0 && <p className="text-sm text-gray-600">Aucun moyen de paiement disponible : contactez-nous sur WhatsApp.</p>}
      </div>

      {selected && selected.key !== 'cod' && (
        <div className="rounded-xl border bg-white divide-y">
          <div className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500">Envoyez par {selected.label} au</p>
              <p className="text-2xl font-bold font-mono tracking-wide">{selected.number}</p>
              <p className="text-xs text-gray-500">{selected.holder}</p>
            </div>
            <button type="button" onClick={() => copy(selected.number || '')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D5FD9] text-white text-sm font-semibold px-3 py-2">
              <Copy className="h-4 w-4" /> Copier
            </button>
          </div>
          <div className="p-4 flex justify-between text-sm">
            <span className="text-gray-500">Motif à indiquer</span><span className="font-mono font-bold">{order.ref}</span>
          </div>
        </div>
      )}
      {selected?.key === 'cod' && (
        <div className="rounded-xl border bg-white p-4 text-sm text-gray-700 space-y-1">
          <p>Vous payez <b>{fmtPrice(order.total_amount)}</b> en espèces à la réception.</p>
          {selected.zones && <p className="text-gray-500">Zones desservies : {selected.zones}</p>}
        </div>
      )}

      <button type="button" className={primaryBtn} disabled={!method || sending} onClick={declare}>
        {sending && <Loader2 className="h-4 w-4 animate-spin" />}
        {method === 'cod' ? 'Confirmer ma commande' : "J'ai payé"}
      </button>
      {method && method !== 'cod' && <p className="text-xs text-center text-gray-500">Cliquez une fois le transfert envoyé : l'équipe vérifie et vous confirme sur WhatsApp.</p>}
    </div>
  );
}

const TIMELINE = [
  { key: 'sent', label: (o: any) => (o.payment_method === 'cod' ? 'Commande enregistrée' : 'Paiement déclaré') },
  { key: 'paid', label: (o: any) => (o.payment_method === 'cod' ? 'Livraison et encaissement' : 'Paiement validé + facture') },
  { key: 'delivery', label: (o: any) => (o.reception === 'pickup' ? "Retrait à l'atelier" : 'Livraison sous 24 h') },
];

export default function FunnelOrder() {
  const { token = '' } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(() => {
    funnelApi.order(token).then((o) => setOrder({ ...o, token })).catch((e) => setError(e.message));
  }, [token]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [order?.status]);

  // Pendant la vérification, la page se met à jour d'elle-même (paiement confirmé → facture payée)
  useEffect(() => {
    if (!order || !['declared', 'cod_pending', 'confirming'].includes(order.status)) return;
    const id = setInterval(() => { if (!document.hidden) load(); }, 30000);
    return () => clearInterval(id);
  }, [order, load]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50"><PromoHeader />
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-3">
          <h1 className="text-2xl font-bold">Commande introuvable</h1>
          <p className="text-gray-600">Ce lien n'est pas valide. Vérifiez le lien reçu par message.</p>
        </div>
      </div>
    );
  }
  if (!order) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#0D5FD9]" /></div>;

  const firstName = (order.customer_name || '').split(' ')[0];
  const wa = whatsappLink(order.whatsapp, `Bonjour, ma commande ${order.ref}`);
  const paying = order.status === 'reserved' || order.status === 'not_received';
  const invoice: Invoice | null = order.invoice;
  const invoicePending = invoice?.invoice_type === 'proforma';

  const download = async () => {
    if (!invoice) return;
    setDownloading(true);
    try { await downloadInvoicePdf(invoice); } catch (e: any) { toast.error('Téléchargement impossible : ' + e.message); } finally { setDownloading(false); }
  };
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `Commande ${order.ref}`, url });
      else { await navigator.clipboard.writeText(url); toast.success('Lien copié'); }
    } catch { /* partage annulé */ }
  };

  const summary = (
    <div className="rounded-xl border bg-white divide-y text-sm">
      {[
        ['Référence', <span className="font-mono font-bold">{order.ref}</span>],
        ['Commande', `${order.variant} × ${order.quantity}`],
        ['Montant', `${fmtPrice(order.total_amount)}${order.payment_method ? ` · ${{ wave: 'Wave', orange_money: 'Orange Money', cod: 'à la livraison' }[order.payment_method as PaymentMethod]}` : ''}`],
        [order.reception === 'pickup' ? 'Retrait' : 'Livraison', order.reception === 'pickup' ? "À l'atelier" : order.address],
        ...(invoice ? [['Facture', invoice.invoice_number]] : []),
      ].map(([k, v]) => (
        <div key={String(k)} className="flex justify-between gap-4 px-4 py-2.5"><span className="text-gray-500">{k}</span><span className="text-right">{v}</span></div>
      ))}
    </div>
  );

  // ── Paiement ──
  if (paying) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PromoHeader whatsapp={order.whatsapp} right={<StepTrail current={2} />} />
        <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
          <div className="md:hidden"><StepBar current={4} total={5} /></div>
          <PaymentStep order={order} onDeclared={load} />
          <div className="pt-2">{summary}</div>
        </div>
      </div>
    );
  }

  // ── Expirée / annulée ──
  if (order.status === 'expired' || order.status === 'cancelled') {
    return (
      <div className="min-h-screen bg-gray-50">
        <PromoHeader whatsapp={order.whatsapp} />
        <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
          <h1 className="text-2xl font-bold">{order.status === 'expired' ? 'Délai de réservation dépassé' : 'Commande annulée'}</h1>
          <p className="text-gray-600">
            {order.status === 'expired'
              ? "Votre réservation n'a pas été payée à temps et le produit a été remis en vente. Vous pouvez recommander si l'offre est toujours disponible."
              : order.cancel_reason || 'Cette commande a été annulée.'}
          </p>
          <Link to={`/promo/${order.funnel.slug}`} className={`${primaryBtn} max-w-xs mx-auto`}>Revoir l'offre</Link>
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="block text-[#0D5FD9] font-semibold">Écrire sur WhatsApp</a>}
        </div>
      </div>
    );
  }

  // ── Confirmation / suivi ──
  const paid = order.status === 'paid';
  const done = (key: string) => key === 'sent' || (key === 'paid' && paid);
  return (
    <div className="min-h-screen bg-gray-50">
      <PromoHeader whatsapp={order.whatsapp} right={<StepTrail current={paid ? 4 : 3} />} />
      <main className="max-w-6xl mx-auto px-4 py-6 lg:py-10">
        <div className="lg:bg-white lg:rounded-2xl lg:border lg:shadow-sm lg:p-10 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-8 lg:gap-12">
          <div className="space-y-6">
            <div className="md:hidden h-1 bg-[#0D5FD9] rounded-full" />
            <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-3">
              <div className="h-14 w-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center"><Check className="h-7 w-7" /></div>
              <h1 className="text-2xl lg:text-4xl font-bold leading-tight">
                {paid ? `Paiement confirmé, merci ${firstName} !` : `Merci ${firstName}, commande reçue`}
              </h1>
              <p className="text-gray-600 max-w-md">
                {paid
                  ? 'Votre facture acquittée est disponible ci-dessous. Nous vous contactons sur WhatsApp pour la livraison.'
                  : order.payment_method === 'cod'
                    ? 'Nous vous appelons sur WhatsApp pour organiser la livraison. Vous payez à la réception.'
                    : 'Nous vérifions votre paiement et vous confirmons sur WhatsApp, en général en moins de 30 minutes. Votre facture sera mise à jour une fois le paiement confirmé.'}
              </p>
              {order.confirmation_message && <p className="text-gray-700 max-w-md whitespace-pre-line">{order.confirmation_message}</p>}
            </div>

            {invoice && (
              <div className="rounded-xl border bg-white p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Votre facture</p>
                    <p className="text-xs text-gray-500 font-mono">{invoice.invoice_number} · PDF</p>
                  </div>
                  <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${invoicePending ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                    {invoicePending ? 'Paiement en attente' : 'Payée'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={download} disabled={downloading}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#0D5FD9] hover:bg-[#0A4AB0] text-white font-semibold h-11 px-4">
                    {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Télécharger la facture
                  </button>
                  <button type="button" onClick={share} aria-label="Partager" className="inline-flex items-center justify-center rounded-lg border h-11 w-11"><Share2 className="h-4 w-4" /></button>
                </div>
              </div>
            )}

            {summary}

            <ol className="space-y-2">
              {TIMELINE.map((s) => (
                <li key={s.key} className={`flex items-center gap-2 text-sm ${done(s.key) ? 'text-gray-900' : 'text-gray-400'}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${done(s.key) ? 'bg-gray-900' : 'border border-gray-300'}`} />{s.label(order)}
                </li>
              ))}
            </ol>

            <div className="space-y-3">
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={primaryBtn}>Écrire sur WhatsApp</a>}
              <Link to="/produits" className="block text-center text-[#0D5FD9] font-semibold">Voir nos autres produits</Link>
            </div>
          </div>

          {invoice && (
            <div className="hidden lg:block min-w-0 bg-gray-100 rounded-xl p-6 self-start">
              <InvoicePreview invoice={invoice} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
