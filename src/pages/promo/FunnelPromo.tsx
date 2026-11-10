// Page publique d'un funnel promo : /promo/:slug
// Mobile : page promo → formule → coordonnées. Desktop : promo + formule sur une page, puis coordonnées.
// La réservation crée un lien privé /promo/commande/:token qui gère le paiement et la confirmation.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Loader2, Minus, Plus } from 'lucide-react';
import { funnelApi, fmtPrice, discountPct, type PublicFunnel } from '@/lib/funnels';
import { OfferBanner, PromoHeader, StepBar, StepTrail, primaryBtn, useCountdown, formatCountdown } from '@/components/promo/PromoShared';

type Step = 'promo' | 'formula' | 'details';

function useIsDesktop() {
  const query = '(min-width: 1024px)';
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setDesktop(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return desktop;
}

function QtyStepper({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="inline-flex items-center rounded-xl border bg-white h-12">
      <button type="button" aria-label="Diminuer" className="w-11 h-full flex items-center justify-center text-gray-500 disabled:opacity-30"
        disabled={value <= 1} onClick={() => onChange(value - 1)}><Minus className="h-4 w-4" /></button>
      <span className="w-8 text-center font-semibold tabular-nums">{value}</span>
      <button type="button" aria-label="Augmenter" className="w-11 h-full flex items-center justify-center text-gray-500 disabled:opacity-30"
        disabled={value >= max} onClick={() => onChange(value + 1)}><Plus className="h-4 w-4" /></button>
    </div>
  );
}

function StockBar({ available, stock }: { available: number; stock: number }) {
  if (stock <= 0) return null;
  const soldPct = Math.min(100, Math.max(8, Math.round((1 - available / stock) * 100)));
  return (
    <div className="space-y-1.5">
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-red-500" style={{ width: `${soldPct}%` }} /></div>
      {available <= 10 && <p className="text-sm font-semibold text-red-600">{available > 0 ? `Plus que ${available} au prix promo` : 'Stock promo épuisé'}</p>}
    </div>
  );
}

export default function FunnelPromo() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const desktop = useIsDesktop();
  const [funnel, setFunnel] = useState<PublicFunnel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('promo');
  const [variantId, setVariantId] = useState<string>('');
  const [qty, setQty] = useState(1);
  const [image, setImage] = useState(0);
  const [form, setForm] = useState({ name: '', phone: '', email: '', reception: 'delivery' as 'delivery' | 'pickup', address: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    funnelApi.get(slug)
      .then((f) => {
        setFunnel(f);
        document.title = `${f.title} — Promo RealTech`;
        const first = f.variants.find((v) => v.available > 0) || f.variants[0];
        if (first) setVariantId(first.id);
      })
      .catch((e) => setError(e.message));
    // Une visite par session et par funnel
    try {
      const key = `promo_visit_${slug}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        funnelApi.visit(slug);
      }
    } catch { funnelApi.visit(slug); }
  }, [slug]);

  // Le formulaire ne passe pas d'une étape à l'autre en haut de page sans remonter
  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);

  const variant = funnel?.variants.find((v) => v.id === variantId) || null;
  const maxQty = variant ? Math.max(1, Math.min(funnel!.max_qty, variant.available)) : 1;
  useEffect(() => { if (qty > maxQty) setQty(maxQty); }, [maxQty, qty]);

  const minPrice = useMemo(() => (funnel?.variants.length ? Math.min(...funnel.variants.map((v) => v.price)) : 0), [funnel]);
  const totalAvailable = funnel?.variants.reduce((s, v) => s + v.available, 0) ?? 0;
  const totalStock = funnel?.variants.reduce((s, v) => s + v.stock, 0) ?? 0;
  const startsIn = useCountdown(funnel?.state === 'scheduled' ? funnel.starts_at : null);
  const price = variant?.price ?? minPrice;
  const total = price * qty;
  const pct = funnel ? discountPct(funnel.regular_price, price) : 0;
  const canOrder = funnel?.state === 'online' && totalAvailable > 0;

  const goNext = () => {
    if (step === 'promo') setStep(desktop ? 'details' : 'formula');
    else if (step === 'formula') setStep('details');
  };
  const goBack = () => setStep(step === 'details' && !desktop ? 'formula' : 'promo');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (form.name.trim().length < 2) return setFormError('Indiquez votre nom complet');
    if (form.phone.replace(/\D/g, '').length < 8) return setFormError('Indiquez un numéro WhatsApp valide');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setFormError('Adresse email invalide');
    if (form.reception === 'delivery' && !form.address.trim()) return setFormError('Indiquez votre adresse de livraison');
    setSubmitting(true);
    try {
      const r = await funnelApi.reserve(slug, { ...form, variant_id: variantId, quantity: qty });
      navigate(`/promo/commande/${r.token}`);
    } catch (err: any) {
      setFormError(err.message);
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PromoHeader />
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
          <h1 className="text-2xl font-bold">Offre introuvable</h1>
          <p className="text-gray-600">Cette promotion n'existe pas ou n'est plus en ligne.</p>
          <Link to="/produits" className="text-[#0D5FD9] font-semibold">Voir nos produits</Link>
        </div>
      </div>
    );
  }
  if (!funnel) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#0D5FD9]" /></div>;
  }

  const images = funnel.images.length ? funnel.images : [];

  // ── Bloc formules (étape 2 sur mobile, intégré à la page sur desktop) ──
  const formulaBlock = (
    <div className="space-y-4">
      {funnel.variants.length > 1 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Formule</p>
          <div className={desktop ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
            {funnel.variants.map((v) => {
              const active = v.id === variantId;
              const soldOut = v.available <= 0;
              return (
                <button key={v.id} type="button" disabled={soldOut} onClick={() => setVariantId(v.id)}
                  className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-colors disabled:opacity-50 ${active ? 'border-[#0D5FD9] bg-blue-50/40' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold leading-snug">{v.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{soldOut ? 'Épuisé' : `${v.available} disponible${v.available > 1 ? 's' : ''}`}</p>
                    </div>
                    <p className="font-bold whitespace-nowrap">{fmtPrice(v.price)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {!desktop && (
        <div className="flex items-center justify-between pt-1">
          <p className="font-semibold">Quantité</p>
          <QtyStepper value={qty} max={maxQty} onChange={setQty} />
        </div>
      )}
      {variant && (
        <p className="text-xs text-gray-500">
          {variant.available < funnel.max_qty
            ? `${variant.available} disponible${variant.available > 1 ? 's' : ''} au prix promo.`
            : `${funnel.max_qty} maximum par commande pendant la promo.`}
        </p>
      )}
    </div>
  );

  // ── Étape coordonnées ──
  if (step === 'details') {
    return (
      <div className="min-h-screen bg-gray-50">
        <PromoHeader whatsapp={funnel.whatsapp} right={desktop ? <StepTrail current={1} /> : undefined} />
        <form onSubmit={submit} className="max-w-xl mx-auto px-4 py-6 pb-36 lg:pb-10 space-y-6">
          {!desktop && <StepBar current={3} total={5} onBack={goBack} />}
          {desktop && <button type="button" onClick={goBack} className="text-sm text-gray-500 hover:text-gray-900">← Modifier la formule</button>}
          <h1 className="text-2xl font-bold">Vos coordonnées</h1>

          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Nom complet</span>
              <input className="w-full h-12 rounded-xl border bg-white px-4 focus:outline-none focus:ring-2 focus:ring-[#0D5FD9]" autoComplete="name"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Moussa Diop" required />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Téléphone WhatsApp</span>
              <input className="w-full h-12 rounded-xl border bg-white px-4 focus:outline-none focus:ring-2 focus:ring-[#0D5FD9]" type="tel" autoComplete="tel"
                value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+221 77 000 00 00" required />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Email <span className="font-normal text-gray-500">(facultatif, pour recevoir votre facture)</span></span>
              <input className="w-full h-12 rounded-xl border bg-white px-4 focus:outline-none focus:ring-2 focus:ring-[#0D5FD9]" type="email" autoComplete="email"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="vous@exemple.com" />
            </label>

            <div className="space-y-1.5">
              <span className="text-sm font-semibold">Réception</span>
              <div className="grid grid-cols-2 gap-3">
                {([['delivery', 'Livraison', 'Dakar sous 24 h'], ['pickup', 'Retrait', "À l'atelier, Ouakam"]] as const).map(([key, label, sub]) => (
                  <button key={key} type="button" onClick={() => setForm({ ...form, reception: key })}
                    className={`text-left rounded-xl border-2 px-4 py-3 ${form.reception === key ? 'border-[#0D5FD9] bg-blue-50/40' : 'border-gray-200 bg-white'}`}>
                    <p className="font-semibold">{label}</p>
                    <p className="text-xs text-gray-500">{sub}</p>
                  </button>
                ))}
              </div>
            </div>
            {form.reception === 'delivery' && (
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Adresse / quartier</span>
                <input className="w-full h-12 rounded-xl border bg-white px-4 focus:outline-none focus:ring-2 focus:ring-[#0D5FD9]" autoComplete="street-address"
                  value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Parcelles U.17, Dakar" />
              </label>
            )}
          </div>

          {formError && <p className="rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{formError}</p>}

          <div className="fixed lg:static bottom-0 inset-x-0 bg-white lg:bg-transparent border-t lg:border-0 p-4 lg:p-0 space-y-3">
            <div className="max-w-xl mx-auto space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{variant?.label} × {qty}</span>
                <span className="font-bold">{fmtPrice(total)}</span>
              </div>
              <button type="submit" className={primaryBtn} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Passer au paiement
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // ── Étape formule (mobile) ──
  if (step === 'formula') {
    return (
      <div className="min-h-screen bg-gray-50">
        <PromoHeader whatsapp={funnel.whatsapp} />
        <div className="max-w-xl mx-auto px-4 py-6 pb-36 space-y-6">
          <StepBar current={2} total={5} onBack={goBack} />
          <h1 className="text-2xl font-bold">Choisissez votre formule</h1>
          {formulaBlock}
        </div>
        <div className="fixed bottom-0 inset-x-0 bg-white border-t p-4">
          <div className="max-w-xl mx-auto space-y-3">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Total</span><span className="font-bold">{fmtPrice(total)}</span></div>
            <button type="button" className={primaryBtn} disabled={!variant || variant.available <= 0} onClick={goNext}>Continuer</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Page promo ──
  return (
    <div className="min-h-screen bg-gray-50">
      {funnel.state === 'online' && <OfferBanner title={funnel.title} endsAt={funnel.ends_at} />}
      <PromoHeader whatsapp={funnel.whatsapp} />
      <main className="max-w-6xl mx-auto lg:px-4 lg:py-10 pb-28 lg:pb-10">
        <div className="bg-white lg:rounded-2xl lg:border lg:shadow-sm lg:p-10 grid lg:grid-cols-2 gap-6 lg:gap-12">
          {/* Visuels */}
          <div className="space-y-3">
            <div className="relative aspect-square bg-gray-100 lg:rounded-xl overflow-hidden">
              {images[image] ? <img src={images[image]} alt={funnel.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Photo du produit</div>}
              {pct > 0 && <span className="absolute top-3 left-3 bg-red-500 text-white text-sm font-bold rounded-md px-2 py-1">−{pct} %</span>}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 px-4 lg:px-0 overflow-x-auto">
                {images.map((src, i) => (
                  <button key={src} type="button" onClick={() => setImage(i)}
                    className={`shrink-0 w-16 h-16 lg:w-20 lg:h-20 rounded-lg overflow-hidden border-2 ${i === image ? 'border-[#0D5FD9]' : 'border-transparent'}`}>
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Offre */}
          <div className="px-4 lg:px-0 space-y-5">
            {funnel.category && <p className="text-sm font-semibold text-[#0D5FD9]">{funnel.category}</p>}
            <h1 className="text-2xl lg:text-4xl font-bold leading-tight">{funnel.title}</h1>
            {funnel.description && <p className="text-gray-600 leading-relaxed whitespace-pre-line">{funnel.description}</p>}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl lg:text-4xl font-bold text-[#0D5FD9]">{funnel.variants.length > 1 && !desktop ? `dès ${fmtPrice(minPrice)}` : fmtPrice(price)}</span>
              {funnel.regular_price > price && <span className="text-gray-400 line-through">{fmtPrice(funnel.regular_price)}</span>}
            </div>
            {funnel.state === 'online' && <StockBar available={totalAvailable} stock={totalStock} />}

            {funnel.state === 'scheduled' && (
              <p className="rounded-xl bg-blue-50 text-blue-800 px-4 py-3 font-medium">
                L'offre commence dans {startsIn ? formatCountdown(startsIn, true) : 'quelques instants'}.
              </p>
            )}
            {funnel.state === 'ended' && (
              <p className="rounded-xl bg-gray-100 text-gray-700 px-4 py-3 font-medium">Cette offre est terminée. <Link to="/produits" className="text-[#0D5FD9]">Voir nos produits</Link></p>
            )}
            {funnel.state === 'online' && totalAvailable <= 0 && (
              <p className="rounded-xl bg-gray-100 text-gray-700 px-4 py-3 font-medium">Stock promo épuisé. Écrivez-nous sur WhatsApp pour être prévenu du prochain arrivage.</p>
            )}

            {funnel.bullets.length > 0 && (
              <ul className="space-y-1.5">
                {funnel.bullets.map((b) => (
                  <li key={b} className="flex gap-2 text-gray-700"><Check className="h-5 w-5 text-emerald-500 shrink-0" />{b}</li>
                ))}
              </ul>
            )}

            {desktop && canOrder && (
              <div className="space-y-4 pt-2">
                {formulaBlock}
                <div className="flex gap-3">
                  <QtyStepper value={qty} max={maxQty} onChange={setQty} />
                  <button type="button" className={`${primaryBtn} flex-1`} disabled={!variant || variant.available <= 0} onClick={goNext}>
                    Commander · {fmtPrice(total)}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  ✓ Livraison Dakar sous 24 h &nbsp; ✓ {funnel.payment.methods.map((m) => m.label).join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {!desktop && canOrder && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t p-4">
          <div className="max-w-xl mx-auto"><button type="button" className={primaryBtn} onClick={goNext}>J'en profite</button></div>
        </div>
      )}
    </div>
  );
}
