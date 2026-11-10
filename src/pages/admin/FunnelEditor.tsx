// Admin · éditeur de funnel (/admin/funnels/nouveau et /admin/funnels/:id) — réservé aux admins
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, ExternalLink, ImagePlus, Loader2, Plus, Star, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  adminFunnelApi, discountPct, fmtPrice, METHOD_LABELS, STATE_LABELS, STATE_STYLES,
  type AdminFunnel, type FunnelVariant, type PaymentMethod, type PaymentSettings,
} from '@/lib/funnels';

type Section = 'offer' | 'page' | 'payment' | 'confirmation';
const SECTIONS: Array<{ key: Section; label: string }> = [
  { key: 'offer', label: 'Offre & formules' },
  { key: 'page', label: 'Page promo' },
  { key: 'payment', label: 'Paiement' },
  { key: 'confirmation', label: 'Confirmation' },
];

interface Product { id: string; name: string; sku: string | null; price: number; stock: number; image_url: string | null; images?: Array<{ url: string }>; is_active: boolean }

const toLocalInput = (iso: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : '');
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

const emptyForm = {
  title: '',
  slug: '',
  product_id: '',
  description: '',
  bullets: ['Livraison Dakar sous 24 h', 'Garantie 12 mois'],
  images: [] as string[], // galerie du funnel ; vide = photos du produit
  starts_at: '',
  ends_at: '',
  is_published: false,
  max_qty: 3,
  payment_methods: { wave: true, orange_money: true, cod: true } as Record<PaymentMethod, boolean>,
  confirmation_message: '',
  variants: [] as FunnelVariant[],
};

export default function FunnelEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>('offer');
  const [form, setForm] = useState(emptyForm);
  const [funnel, setFunnel] = useState<AdminFunnel | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!isNew);

  useEffect(() => {
    apiFetch('/api/products/all?limit=1000').then((r) => r.json()).then((j) => setProducts(j.data || [])).catch(() => {});
    adminFunnelApi.settings().then(setSettings).catch(() => {});
    if (!id) return;
    adminFunnelApi.get(id)
      .then((f) => {
        setFunnel(f);
        setForm({
          title: f.title,
          slug: f.slug,
          product_id: f.product_id,
          description: f.description || '',
          bullets: f.bullets?.length ? f.bullets : [],
          images: f.images?.length ? f.images : f.image_url ? [f.image_url] : [],
          starts_at: toLocalInput(f.starts_at),
          ends_at: toLocalInput(f.ends_at),
          is_published: f.is_published,
          max_qty: f.max_qty,
          payment_methods: { wave: true, orange_money: true, cod: true, ...(f.payment_methods || {}) },
          confirmation_message: f.confirmation_message || '',
          variants: (f.variants || []).map((v) => ({ ...v, price: Number(v.price) })),
        });
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const product = products.find((p) => p.id === form.product_id) || null;
  const regularPrice = product ? Number(product.price) : funnel?.regular_price || 0;
  const activeVariants = form.variants.filter((v) => v.is_active);
  const promoPrice = activeVariants.length ? Math.min(...activeVariants.map((v) => Number(v.price) || 0)) : 0;
  const pct = discountPct(regularPrice, promoPrice);
  // Photos du produit (galerie par défaut) ; toute modification crée la galerie propre au funnel
  const productPhotos = useMemo(
    () => [...new Set([product?.image_url, ...(product?.images || []).map((i) => i.url)].filter(Boolean) as string[])],
    [product]
  );
  const gallery = form.images.length ? form.images : productPhotos;
  const usesProductPhotos = form.images.length === 0;
  const previewImage = gallery[0] || funnel?.image || null;
  const setGallery = (list: string[]) => setForm((f) => ({ ...f, images: list }));
  const moveImage = (i: number, to: number) => {
    if (to < 0 || to >= gallery.length) return;
    const list = [...gallery];
    const [img] = list.splice(i, 1);
    list.splice(to, 0, img);
    setGallery(list);
  };

  // Prix / stock promo saisis = ceux de la formule principale (la première)
  const setFirstVariant = (patch: Partial<FunnelVariant>) => {
    if (form.variants.length) setVariant(0, patch);
    else set('variants', [{ label: product ? `${product.name} seule` : 'Formule unique', price: 0, stock: Math.min(10, Number(product?.stock) || 0), is_active: true, ...patch }]);
  };
  const multiFormula = form.variants.length > 1;
  const realStock = Number(product?.stock ?? funnel?.product_stock ?? 0);
  // Quantité qu'un client peut réellement commander : quantité max., stock promo restant et stock réel
  const orderableQty = Math.max(0, Math.min(
    form.max_qty,
    realStock || Infinity,
    Math.max(0, ...form.variants.filter((v) => v.is_active).map((v) => Number(v.stock) - Number(v.held || 0))),
  ));

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setVariant = (i: number, patch: Partial<FunnelVariant>) =>
    setForm((f) => ({ ...f, variants: f.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) }));

  const pickProduct = (p: Product) => {
    setForm((f) => ({
      ...f,
      product_id: p.id,
      title: f.title || p.name,
      slug: slugTouched ? f.slug : '',
      variants: f.variants.length ? f.variants : [{ label: `${p.name} seule`, price: Math.round(Number(p.price) * 0.85), stock: Math.min(10, Number(p.stock) || 0), is_active: true }],
    }));
    setProductSearch('');
  };

  const productResults = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)).slice(0, 8);
  }, [productSearch, products]);

  // Ajout de photos (plusieurs à la fois), à la suite de la galerie affichée
  const uploadImages = async (files: File[]) => {
    const base = gallery;
    setUploading(true);
    const added: string[] = [];
    try {
      for (const file of files) {
        if (base.length + added.length >= 12) { toast.error('12 photos maximum'); break; }
        if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} : trop lourde (5 Mo max)`); continue; }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        const resp = await apiFetch('/api/uploads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: dataUrl, folder: 'funnels' }) });
        const j = await resp.json().catch(() => ({}));
        if (!resp.ok) { toast.error(`${file.name} : ${j.error || 'envoi impossible'}`); continue; }
        added.push(j.data.url);
      }
    } finally {
      if (added.length) setGallery([...base, ...added]);
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await adminFunnelApi.save(id || null, {
        ...form,
        slug: slugTouched ? form.slug : '',
        bullets: form.bullets.map((b) => b.trim()).filter(Boolean),
        starts_at: fromLocalInput(form.starts_at),
        ends_at: fromLocalInput(form.ends_at),
        variants: form.variants.map((v) => ({ id: v.id, label: v.label, price: Number(v.price), stock: Number(v.stock), is_active: v.is_active })),
      });
      toast.success(isNew ? 'Funnel créé' : 'Funnel enregistré');
      setFunnel(saved);
      setForm((f) => ({ ...f, slug: saved.slug, variants: (saved.variants || []).map((v) => ({ ...v, price: Number(v.price) })) }));
      setSlugTouched(true);
      if (isNew) navigate(`/admin/funnels/${saved.id}`, { replace: true });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id || !window.confirm('Supprimer ce funnel ? Cette action est définitive.')) return;
    try {
      await adminFunnelApi.remove(id);
      toast.success('Funnel supprimé');
      navigate('/admin/funnels');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const publicUrl = `${window.location.origin}/promo/${funnel?.slug || form.slug || '…'}`;

  if (loading) return <div className="py-24 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Barre du haut */}
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <Link to="/admin/funnels" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Funnels</Link>
        <span className="text-muted-foreground">|</span>
        <h1 className="font-semibold truncate max-w-[40ch]">{form.title || 'Nouveau funnel'}</h1>
        {funnel && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATE_STYLES[funnel.state]}`}>{STATE_LABELS[funnel.state]}</span>}
        <div className="flex-1" />
        {funnel && (
          <button type="button" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success('Lien copié'); }}
            className="hidden md:inline-flex items-center gap-1.5 rounded-lg border bg-muted/40 px-3 py-1.5 font-mono text-xs text-muted-foreground hover:text-foreground">
            {publicUrl.replace(/^https?:\/\//, '')} <Copy className="h-3.5 w-3.5" />
          </button>
        )}
        {funnel && <Button variant="outline" size="sm" asChild><a href={`/promo/${funnel.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-1.5" />Aperçu</a></Button>}
        {funnel && <Button variant="outline" size="sm" asChild><Link to={`/admin/funnels/${funnel.id}/commandes`}>Commandes</Link></Button>}
        <Button size="sm" onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Enregistrer</Button>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr_340px]">
        {/* Étapes */}
        <aside className="border-b lg:border-b-0 lg:border-r p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sections</p>
          <nav className="flex lg:flex-col gap-1 overflow-x-auto">
            {SECTIONS.map((s, i) => (
              <button key={s.key} type="button" onClick={() => setSection(s.key)}
                className={`text-left whitespace-nowrap rounded-lg px-3 py-2 text-sm ${section === s.key ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-muted'}`}>
                <span className="font-mono text-xs text-muted-foreground mr-2">0{i + 1}</span>{s.label}
              </button>
            ))}
          </nav>
          <div className="hidden lg:block rounded-lg bg-muted/50 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="pub" className="text-sm">Publié</Label>
              <Switch id="pub" checked={form.is_published} onCheckedChange={(v) => set('is_published', v)} />
            </div>
            <p className="text-xs text-muted-foreground">Brouillon : la page n'est pas visible. Publié : visible aux dates de l'offre.</p>
          </div>
          {!isNew && <button type="button" onClick={remove} className="hidden lg:inline-flex items-center gap-1.5 text-xs text-red-600 hover:underline"><Trash2 className="h-3.5 w-3.5" />Supprimer le funnel</button>}
        </aside>

        {/* Formulaire */}
        <section className="p-5 lg:p-6 space-y-6 min-w-0">
          {section === 'offer' && (
            <>
              <div>
                <h2 className="text-xl font-bold">Offre & formules</h2>
                <p className="text-sm text-muted-foreground">Produit du catalogue, prix, période et ce que le client peut choisir.</p>
              </div>

              <div className="space-y-2">
                <Label>Produit</Label>
                {form.product_id ? (
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="h-12 w-12 rounded bg-muted overflow-hidden shrink-0">{previewImage && <img src={previewImage} alt="" className="h-full w-full object-cover" />}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{product?.name || funnel?.product_name}</p>
                      <p className="text-xs text-muted-foreground">{product?.sku || funnel?.product_sku || '—'} · stock réel {product?.stock ?? funnel?.product_stock}</p>
                    </div>
                    <button type="button" onClick={() => set('product_id', '')} className="text-sm font-semibold text-blue-600">Changer</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input placeholder="Rechercher un produit (nom ou code)…" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} autoFocus />
                    {productResults.length > 0 && (
                      <div className="rounded-lg border divide-y max-h-72 overflow-y-auto">
                        {productResults.map((p) => (
                          <button key={p.id} type="button" onClick={() => pickProduct(p)} className="w-full flex justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted">
                            <span className="truncate">{p.name} <span className="text-muted-foreground">{p.sku}</span></span>
                            <span className="text-muted-foreground whitespace-nowrap">{fmtPrice(p.price)} · stock {p.stock}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label>Prix normal</Label>
                  <Input value={fmtPrice(regularPrice)} disabled />
                  <p className="text-xs text-muted-foreground">Prix du catalogue</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="promo">Prix promo (F CFA)</Label>
                  <Input id="promo" type="number" min={0} step={500} value={form.variants[0]?.price ?? ''} placeholder="Ex. 225000"
                    onChange={(e) => setFirstVariant({ price: Number(e.target.value) })} />
                  <p className="text-xs text-muted-foreground">
                    {discountPct(regularPrice, Number(form.variants[0]?.price) || 0) > 0
                      ? `−${discountPct(regularPrice, Number(form.variants[0]?.price) || 0)} % sur le prix normal`
                      : regularPrice && Number(form.variants[0]?.price) >= regularPrice ? 'Pas moins cher que le prix normal' : ' '}
                    {multiFormula && ` · formule « ${form.variants[0].label || '1'} »`}
                  </p>
                </div>
                {!multiFormula && (
                  <div className="space-y-1.5">
                    <Label htmlFor="pstock">Stock promo (unités)</Label>
                    <Input id="pstock" type="number" min={0} value={form.variants[0]?.stock ?? ''} placeholder="Ex. 10"
                      onChange={(e) => setFirstVariant({ stock: Number(e.target.value) })} />
                    <p className="text-xs text-muted-foreground">
                      Unités vendues à ce prix.{' '}
                      {realStock > 0 && Number(form.variants[0]?.stock) !== realStock && (
                        <button type="button" className="text-blue-600 font-semibold" onClick={() => setFirstVariant({ stock: realStock })}>Tout le stock ({realStock})</button>
                      )}
                    </p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="maxq">Quantité max. par client</Label>
                  <Input id="maxq" type="number" min={1} max={100} value={form.max_qty} onChange={(e) => set('max_qty', Number(e.target.value))} />
                  <p className="text-xs text-muted-foreground">Par commande, pour éviter qu'un seul client prenne tout</p>
                </div>
              </div>

              {/* Ce que le client pourra réellement commander */}
              {form.variants.length > 0 && (
                <p className={`rounded-lg px-3 py-2 text-sm ${orderableQty < Math.min(form.max_qty, 2) || orderableQty < form.max_qty ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'}`}>
                  {orderableQty <= 0
                    ? 'Plus aucune unité disponible au prix promo : les clients ne peuvent pas commander. Augmentez le stock promo.'
                    : `Un client pourra commander jusqu'à ${orderableQty} unité${orderableQty > 1 ? 's' : ''}.`}
                  {orderableQty > 0 && orderableQty < form.max_qty && ` La quantité max. (${form.max_qty}) est limitée par le stock promo encore disponible (${orderableQty}) : augmentez le stock promo pour en vendre plus.`}
                </p>
              )}

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="start">Début</Label>
                  <Input id="start" type="datetime-local" value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="end">Fin (compte à rebours)</Label>
                  <Input id="end" type="datetime-local" value={form.ends_at} onChange={(e) => set('ends_at', e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>Formules</Label>
                    <p className="text-xs text-muted-foreground">
                      {multiFormula
                        ? 'Le client choisit une formule : chacune a son prix et son propre stock promo.'
                        : 'Une seule formule : le produit seul, au prix promo ci-dessus. Facultatif.'}
                    </p>
                  </div>
                  <button type="button" className="shrink-0 text-sm font-semibold text-blue-600 inline-flex items-center gap-1"
                    onClick={() => set('variants', [...form.variants, { label: '', price: promoPrice || regularPrice, stock: 1, is_active: true }])}>
                    <Plus className="h-4 w-4" />{multiFormula ? 'Ajouter une formule' : 'Proposer plusieurs formules'}
                  </button>
                </div>
                {multiFormula && (
                  <div className="rounded-lg border divide-y">
                    <div className="grid grid-cols-[1fr_120px_90px_auto_28px] gap-2 px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/40">
                      <span>Nom affiché (ex. Presse + 50 mugs)</span><span>Prix (F)</span><span>Stock promo</span><span>Active</span><span />
                    </div>
                    {form.variants.map((v, i) => (
                      <div key={v.id || i} className={`grid grid-cols-[1fr_120px_90px_auto_28px] items-center gap-2 p-2 ${v.is_active ? '' : 'opacity-60'}`}>
                        <Input aria-label="Nom de la formule" placeholder="Ex. Presse + 50 mugs" value={v.label} onChange={(e) => setVariant(i, { label: e.target.value })} />
                        <Input aria-label="Prix" type="number" min={0} value={v.price} onChange={(e) => setVariant(i, { price: Number(e.target.value) })} />
                        <Input aria-label="Stock promo" type="number" min={0} value={v.stock} onChange={(e) => setVariant(i, { stock: Number(e.target.value) })} />
                        <Switch aria-label="Formule active" checked={v.is_active} onCheckedChange={(c) => setVariant(i, { is_active: c })} />
                        <button type="button" aria-label="Retirer" className="p-1.5 text-muted-foreground hover:text-red-600"
                          onClick={() => set('variants', form.variants.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
                        {v.held ? <p className="col-span-5 px-1 text-xs text-muted-foreground">{v.held} réservé(s) ou vendu(s) · {v.available} encore disponible(s)</p> : null}
                      </div>
                    ))}
                  </div>
                )}
                {!multiFormula && form.variants[0]?.held ? (
                  <p className="text-xs text-muted-foreground">{form.variants[0].held} unité(s) déjà réservée(s) ou vendue(s) sur {form.variants[0].stock}.</p>
                ) : null}
                {multiFormula && <p className="text-xs text-muted-foreground">Une formule déjà commandée qu'on retire est seulement désactivée.</p>}
              </div>
            </>
          )}

          {section === 'page' && (
            <>
              <div>
                <h2 className="text-xl font-bold">Page promo</h2>
                <p className="text-sm text-muted-foreground">Ce que voit le client en arrivant sur le lien.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="title">Titre</Label>
                  <Input id="title" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Presse à chaud 5-en-1" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="slug">Adresse de la page</Label>
                  <div className="flex items-center rounded-md border bg-muted/40 pl-3 text-sm">
                    <span className="text-muted-foreground whitespace-nowrap">realtechprint.com/promo/</span>
                    <input id="slug" className="flex-1 bg-transparent h-10 px-1 outline-none font-mono" value={form.slug} placeholder="générée depuis le titre"
                      onChange={(e) => { setSlugTouched(true); set('slug', e.target.value); }} />
                  </div>
                  {funnel && form.slug !== funnel.slug && <p className="text-xs text-amber-700">Attention : l'ancien lien ne fonctionnera plus.</p>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="desc">Description</Label>
                <Textarea id="desc" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="T-shirts, mugs, casquettes et assiettes avec une seule machine." />
              </div>
              <div className="space-y-2">
                <Label>Arguments (cochés sous le prix)</Label>
                {form.bullets.map((b, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={b} onChange={(e) => set('bullets', form.bullets.map((x, j) => (j === i ? e.target.value : x)))} />
                    <Button type="button" variant="ghost" size="icon" aria-label="Retirer" onClick={() => set('bullets', form.bullets.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
                {form.bullets.length < 8 && <button type="button" className="text-sm font-semibold text-blue-600" onClick={() => set('bullets', [...form.bullets, ''])}>+ Ajouter un argument</button>}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>Photos ({gallery.length}/12)</Label>
                  {!usesProductPhotos && productPhotos.length > 0 && (
                    <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => setGallery([])}>Revenir aux photos du produit</button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {usesProductPhotos ? 'Photos du produit utilisées par défaut. ' : ''}La première est la photo principale ; les autres s'affichent en miniatures sous elle.
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {gallery.map((src, i) => (
                    <div key={src} className={`group relative aspect-square rounded-lg overflow-hidden border-2 ${i === 0 ? 'border-blue-600' : 'border-transparent'} bg-muted`}>
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      {i === 0 && <span className="absolute top-1.5 left-1.5 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">Principale</span>}
                      <button type="button" aria-label="Retirer la photo" onClick={() => setGallery(gallery.filter((_, j) => j !== i))}
                        className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-red-600"><X className="h-3.5 w-3.5" /></button>
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/55 px-1 py-1">
                        <button type="button" aria-label="Avancer" disabled={i === 0} onClick={() => moveImage(i, i - 1)} className="p-0.5 text-white disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                        {i > 0 && (
                          <button type="button" onClick={() => moveImage(i, 0)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-white">
                            <Star className="h-3 w-3" />Principale
                          </button>
                        )}
                        <button type="button" aria-label="Reculer" disabled={i === gallery.length - 1} onClick={() => moveImage(i, i + 1)} className="p-0.5 text-white disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                  {gallery.length < 12 && (
                    <label className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 text-sm text-muted-foreground cursor-pointer hover:bg-muted">
                      {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                      {uploading ? 'Envoi…' : 'Ajouter'}
                      <input type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploading}
                        onChange={(e) => { const files = Array.from(e.target.files || []); e.target.value = ''; if (files.length) uploadImages(files); }} />
                    </label>
                  )}
                </div>
              </div>
            </>
          )}

          {section === 'payment' && (
            <>
              <div>
                <h2 className="text-xl font-bold">Paiement</h2>
                <p className="text-sm text-muted-foreground">Moyens proposés sur ce funnel. Numéros et délai de réservation : <Link to="/admin/funnels/paiement" className="text-blue-600 font-semibold">Réglages paiement</Link>.</p>
              </div>
              <div className="rounded-lg border divide-y">
                {(['wave', 'orange_money', 'cod'] as PaymentMethod[]).map((m) => {
                  const s = settings?.[m];
                  const globallyOff = settings && (!s?.enabled || (m !== 'cod' && !(s as any).number));
                  return (
                    <div key={m} className="flex items-center gap-3 p-3">
                      <div className="flex-1">
                        <p className="font-semibold">{METHOD_LABELS[m]}</p>
                        <p className="text-xs text-muted-foreground">
                          {globallyOff ? 'Désactivé dans les réglages'
                            : m === 'cod' ? `Zones : ${settings?.cod.zones || '—'} · jusqu'à ${fmtPrice(settings?.cod.max_amount)}`
                            : `${(s as any)?.number} · ${(s as any)?.holder}`}
                        </p>
                      </div>
                      <Switch checked={form.payment_methods[m]} disabled={!!globallyOff}
                        onCheckedChange={(c) => set('payment_methods', { ...form.payment_methods, [m]: c })} />
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-muted-foreground">
                Wave et Orange Money : la commande est réservée {settings?.reservation_minutes ?? 30} minutes, le client paie puis clique « J'ai payé » avec la référence RT-xxxx en motif.
                Vous confirmez dans <b>Commandes</b> du funnel après vérification dans l'application.
              </p>
            </>
          )}

          {section === 'confirmation' && (
            <>
              <div>
                <h2 className="text-xl font-bold">Confirmation</h2>
                <p className="text-sm text-muted-foreground">Message affiché au client après sa commande (en plus de la facture et du suivi).</p>
              </div>
              <Textarea rows={4} value={form.confirmation_message} onChange={(e) => set('confirmation_message', e.target.value)}
                placeholder="Ex. Démonstration offerte à l'atelier de Ouakam sur rendez-vous." />
              <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-1">
                <p className="font-semibold">Mails envoyés automatiquement (via n8n)</p>
                <p className="text-muted-foreground">Client (s'il a donné son email) : commande reçue, paiement confirmé, relance si paiement non reçu, annulation ou réservation expirée.</p>
                <p className="text-muted-foreground">Équipe : alerte à chaque paiement déclaré ({settings?.team_email || 'email à renseigner dans les réglages'}).</p>
              </div>
            </>
          )}

          <div className="lg:hidden flex items-center justify-between rounded-lg bg-muted/50 p-3">
            <Label htmlFor="pub-m">Publié</Label>
            <Switch id="pub-m" checked={form.is_published} onCheckedChange={(v) => set('is_published', v)} />
          </div>
        </section>

        {/* Aperçu mobile */}
        <aside className="hidden lg:flex flex-col items-center gap-3 bg-muted/40 border-l p-6">
          <p className="font-mono text-xs text-muted-foreground">Aperçu mobile · page promo</p>
          <div className="w-[260px] h-[520px] rounded-[28px] border-[6px] border-gray-900 bg-white overflow-hidden flex flex-col">
            <div className="bg-[#0D5FD9] text-white text-[10px] px-3 py-1.5 flex justify-between"><span>Fin de l'offre dans</span><span className="font-mono">04j 09h</span></div>
            <div className="flex-1 overflow-hidden p-3 space-y-2">
              <div className="relative aspect-square rounded-lg bg-muted overflow-hidden">
                {previewImage && <img src={previewImage} alt="" className="h-full w-full object-cover" />}
                {pct > 0 && <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold rounded px-1.5 py-0.5">−{pct} %</span>}
              </div>
              <p className="font-bold leading-tight">{form.title || 'Titre de la promo'}</p>
              <p className="text-[11px] text-muted-foreground line-clamp-2">{form.description}</p>
              <p><span className="font-bold text-[#0D5FD9]">{fmtPrice(promoPrice)}</span> {regularPrice > promoPrice && <span className="text-xs text-muted-foreground line-through">{fmtPrice(regularPrice)}</span>}</p>
              <ul className="text-[11px] space-y-0.5">{form.bullets.filter(Boolean).slice(0, 3).map((b) => <li key={b}>✓ {b}</li>)}</ul>
            </div>
            <div className="p-3"><div className="rounded-lg bg-[#22C55E] text-white text-center text-xs font-semibold py-2.5">J'en profite</div></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
