import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileText, FilePlus, Plus, Download, ShoppingCart, XCircle, Loader2, Search, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { INVOICE_TYPE_LABELS, ORDER_STATUS_LABELS, type Invoice } from "@/lib/invoiceTemplate";
import { createInvoiceFromOrder, downloadInvoicePdf, fetchInvoice, fetchInvoices } from "@/lib/invoicePdf";

type Line = {
  key: string;
  product_id?: string;
  service_id?: string;
  name: string;
  quantity: number;
  unit_price: number;
};

const STATUS_LABELS: Record<Invoice['status'], { label: string; className: string }> = {
  issued: { label: 'Émise', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  converted: { label: 'Transformée en commande', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Annulée', className: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(amount) || 0) + ' F CFA';

const formatDate = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '';
  }
};

const Invoices = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Nouvelle proforma
  const [proformaOpen, setProformaOpen] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [clientId, setClientId] = useState<string>('');
  const [clientSearch, setClientSearch] = useState('');
  const [freeClient, setFreeClient] = useState({ name: '', phone: '', email: '' });
  const [catalogSearch, setCatalogSearch] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [savingProforma, setSavingProforma] = useState(false);

  // Facturer une commande existante
  const [orderInvOpen, setOrderInvOpen] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [invOrder, setInvOrder] = useState<any>(null);
  const [orderInvoices, setOrderInvoices] = useState<Invoice[]>([]);
  const [generating, setGenerating] = useState(false);

  // Transformation en commande
  const [convertInvoice, setConvertInvoice] = useState<Invoice | null>(null);
  const [converting, setConverting] = useState(false);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      setInvoices(await fetchInvoices({ type: typeFilter === 'all' ? '' : typeFilter }));
    } catch (err: any) {
      toast.error('Chargement des factures : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInvoices(); }, [typeFilter]);

  useEffect(() => {
    apiFetch('/api/users/me')
      .then(r => (r.ok ? r.json() : null))
      .then(p => {
        const roles: string[] = (p?.user?.roles || []).map((r: any) => String(r || '').toLowerCase());
        setIsAdmin(roles.includes('admin'));
      })
      .catch(() => setIsAdmin(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(inv =>
      inv.invoice_number.toLowerCase().includes(q)
      || (inv.client?.name || '').toLowerCase().includes(q)
      || (inv.client?.phone || '').includes(q));
  }, [invoices, search]);

  // Cachet sur les factures définitives dont la commande est terminée
  const downloadFull = async (id: string) => {
    const full = await fetchInvoice(id);
    const orderStatus = full.order_state?.order_status || full.order_status;
    await downloadInvoicePdf(full, { stamp: full.invoice_type === 'definitive' && orderStatus === 'completed' });
  };

  const printInvoice = async (inv: Invoice) => {
    setBusyId(inv.id);
    try {
      await downloadFull(inv.id);
    } catch (err: any) {
      toast.error('Erreur PDF : ' + err.message);
    } finally {
      setBusyId(null);
    }
  };

  const cancelInvoice = async (inv: Invoice) => {
    if (!window.confirm(`Annuler la facture ${inv.invoice_number} ? Le numéro reste attribué.`)) return;
    setBusyId(inv.id);
    try {
      const resp = await apiFetch(`/api/admin/invoices/${inv.id}/cancel`, { method: 'PATCH' });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(body.error || resp.statusText);
      toast.success(`Facture ${inv.invoice_number} annulée`);
      loadInvoices();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  // ── Facturer une commande ───────────────────────────────────────────────
  const orderLabel = (o: any) => `CMD-${String(o.id || '').substring(0, 8).toUpperCase()}`;
  const orderClientName = (o: any) => o.metadata?.customer?.name || o.customer_name || 'Client';

  const openOrderInvoice = async () => {
    setOrderSearch('');
    setInvOrder(null);
    setOrderInvoices([]);
    setOrderInvOpen(true);
    setOrdersLoading(true);
    try {
      const resp = await apiFetch('/api/admin/orders');
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(body.error || resp.statusText);
      setOrders((body.data || []).filter((o: any) => o.status !== 'cancelled'));
    } catch (err: any) {
      toast.error('Chargement des commandes : ' + err.message);
    } finally {
      setOrdersLoading(false);
    }
  };

  const orderResults = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    const list = q
      ? orders.filter(o =>
          orderLabel(o).toLowerCase().includes(q)
          || orderClientName(o).toLowerCase().includes(q)
          || (o.metadata?.customer?.phone || '').includes(q))
      : orders;
    return list.slice(0, 10);
  }, [orderSearch, orders]);

  const selectOrder = async (o: any) => {
    setInvOrder(o);
    setOrderInvoices([]);
    try {
      setOrderInvoices(await fetchInvoices({ order_id: o.id }));
    } catch (err: any) {
      toast.error('Factures existantes : ' + err.message);
    }
  };

  // Le type de facture découle de l'état de paiement enregistré dans Commandes
  const paidOf = (o: any) => Number(o?.amount_paid || 0);
  const remainingOf = (o: any) => Math.max(0, Number(o?.total_amount || 0) - paidOf(o));
  const autoType = (o: any): 'definitive' | 'acompte' | null =>
    paidOf(o) <= 0 ? null : remainingOf(o) <= 0 ? 'definitive' : 'acompte';
  const invType = autoType(invOrder);
  // Une seule facture par commande : si elle existe, elle est réimprimée à jour (même numéro)
  const reusable = orderInvoices.find(inv => inv.status !== 'cancelled' && inv.invoice_type !== 'proforma');

  const paymentBadge = (o: any) => {
    const t = autoType(o);
    if (!t) return <Badge variant="outline" className="bg-gray-50 text-gray-600">Non payée</Badge>;
    if (t === 'definitive') return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Payée</Badge>;
    return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Reste {formatCurrency(remainingOf(o))}</Badge>;
  };

  const generateOrderInvoice = async () => {
    if (!invOrder || !invType) return;
    setGenerating(true);
    try {
      const { invoice, reused } = await createInvoiceFromOrder(invOrder.id);
      toast.success(reused ? `Réimpression de la facture ${invoice.invoice_number}` : `Facture ${invoice.invoice_number} générée`);
      await downloadFull(invoice.id);
      setOrderInvOpen(false);
      loadInvoices();
    } catch (err: any) {
      toast.error('Erreur facture : ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  // ── Proforma ──────────────────────────────────────────────────────────────
  const openProforma = async () => {
    setClientId('');
    setClientSearch('');
    setFreeClient({ name: '', phone: '', email: '' });
    setCatalogSearch('');
    setLines([]);
    setDiscount(0);
    setNotes('');
    setProformaOpen(true);
    if (products.length || services.length || clients.length) return;
    const [p, s, c]: any[] = await Promise.all([
      apiFetch('/api/products?limit=1000').then(r => (r.ok ? r.json() : {})).catch(() => ({})),
      apiFetch('/api/admin/services?limit=1000').then(r => (r.ok ? r.json() : {})).catch(() => ({})),
      apiFetch('/api/admin/clients?limit=1000').then(r => (r.ok ? r.json() : {})).catch(() => ({})),
    ]);
    setProducts(p.data || []);
    setServices(s.data || []);
    setClients(c.data || []);
  };

  const catalogResults = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return [];
    const prods = products
      .filter(p => (p.name || '').toLowerCase().includes(q))
      .map(p => ({ kind: 'product' as const, id: p.id, name: p.name, price: Number(p.price || 0), extra: `Stock : ${p.stock ?? '—'}` }));
    const servs = services
      .filter(s => (s.name || '').toLowerCase().includes(q))
      .map(s => ({ kind: 'service' as const, id: s.id, name: s.name, price: Number(s.price || 0), extra: 'Service' }));
    return [...prods, ...servs].slice(0, 8);
  }, [catalogSearch, products, services]);

  const clientResults = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return [];
    return clients
      .filter(c => (c.full_name || '').toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.email || '').toLowerCase().includes(q))
      .slice(0, 6);
  }, [clientSearch, clients]);

  const selectedClient = clients.find(c => c.id === clientId);

  const addLine = (r: { kind: 'product' | 'service'; id: string; name: string; price: number }) => {
    setLines(prev => {
      const existing = prev.find(l => (r.kind === 'product' ? l.product_id : l.service_id) === r.id);
      if (existing) return prev.map(l => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, {
        key: `${r.kind}-${r.id}`,
        ...(r.kind === 'product' ? { product_id: r.id } : { service_id: r.id }),
        name: r.name,
        quantity: 1,
        unit_price: r.price,
      }];
    });
    setCatalogSearch('');
  };

  const addFreeLine = () =>
    setLines(prev => [...prev, { key: `free-${Date.now()}`, name: '', quantity: 1, unit_price: 0 }]);

  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines(prev => prev.map(l => (l.key === key ? { ...l, ...patch } : l)));

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const total = Math.max(0, subtotal - (discount || 0));

  const saveProforma = async () => {
    if (lines.length === 0) { toast.error('Ajoutez au moins un article'); return; }
    if (lines.some(l => !l.product_id && !l.service_id && !l.name.trim())) { toast.error('Chaque ligne libre doit avoir une désignation'); return; }
    if (!clientId && !freeClient.name.trim() && !freeClient.phone.trim()) { toast.error('Choisissez un client ou saisissez son nom / téléphone'); return; }
    setSavingProforma(true);
    try {
      const resp = await apiFetch('/api/admin/invoices/proforma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId || undefined,
          client: clientId ? undefined : freeClient,
          items: lines.map(l => ({ product_id: l.product_id, service_id: l.service_id, name: l.name, quantity: l.quantity, unit_price: l.unit_price })),
          discount,
          notes: notes || null,
        }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(body.error || resp.statusText);
      toast.success(`Proforma ${body.data.invoice_number} créée`);
      setProformaOpen(false);
      loadInvoices();
      await downloadInvoicePdf(body.data);
    } catch (err: any) {
      toast.error('Erreur proforma : ' + err.message);
    } finally {
      setSavingProforma(false);
    }
  };

  // ── Proforma → commande ──────────────────────────────────────────────────
  const confirmConvert = async () => {
    const inv = convertInvoice;
    if (!inv) return;
    setConverting(true);
    try {
      const resp = await apiFetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proforma_id: inv.id,
          sale_type: 'order',
          initial_status: 'pending',
          client_id: inv.client_id || undefined,
          customer_name: inv.client?.name || null,
          customer_phone: inv.client?.phone || null,
          customer_email: inv.client?.email || null,
          discount: Number(inv.discount || 0),
          notes: inv.notes || null,
          items: inv.items.map(it => ({
            product_id: it.product_id || undefined,
            service_id: it.service_id || undefined,
            product_name: it.product_id || !it.service_id ? it.name : undefined,
            service_name: it.service_id ? it.name : undefined,
            quantity: it.quantity,
            unit_price: it.unit_price,
          })),
          metadata: { admin_created: true, sale_type: 'order', from_proforma: inv.invoice_number },
        }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(body.error || resp.statusText);
      toast.success(`Proforma ${inv.invoice_number} transformée en commande`);
      setConvertInvoice(null);
      loadInvoices();
    } catch (err: any) {
      toast.error('Transformation impossible : ' + err.message);
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6 text-blue-600" /> Factures</h1>
          <p className="text-sm text-muted-foreground">Numérotation unique et séquentielle pour tous les types de facture.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={openOrderInvoice}><FilePlus className="mr-2 h-4 w-4" /> Facturer une commande</Button>
          <Button variant="outline" onClick={openProforma}><Plus className="mr-2 h-4 w-4" /> Nouvelle proforma</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Liste des factures</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="N° de facture, client, téléphone…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="definitive">Définitive</SelectItem>
                <SelectItem value="acompte">Acompte</SelectItem>
                <SelectItem value="proforma">Proforma</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">Aucune facture.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N°</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(inv => (
                    <TableRow key={inv.id} className={inv.status === 'cancelled' ? 'opacity-60' : ''}>
                      <TableCell className="font-medium whitespace-nowrap">{inv.invoice_number}</TableCell>
                      <TableCell><Badge variant="outline">{INVOICE_TYPE_LABELS[inv.invoice_type]}</Badge></TableCell>
                      <TableCell>
                        <div>{inv.client?.name || '—'}</div>
                        {inv.client?.phone && <div className="text-xs text-muted-foreground">{inv.client.phone}</div>}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {inv.invoice_type === 'acompte' ? (
                          <>
                            <div>{formatCurrency(Number(inv.acompte_amount || 0))}</div>
                            <div className="text-xs text-muted-foreground">payé sur {formatCurrency(Number(inv.total_amount))}</div>
                          </>
                        ) : formatCurrency(Number(inv.total_amount))}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(inv.issued_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_LABELS[inv.status].className}>{STATUS_LABELS[inv.status].label}</Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" title="Télécharger le PDF" disabled={busyId === inv.id} onClick={() => printInvoice(inv)}>
                          {busyId === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        </Button>
                        {inv.invoice_type === 'proforma' && inv.status === 'issued' && (
                          <Button size="sm" variant="ghost" title="Transformer en commande" onClick={() => setConvertInvoice(inv)}>
                            <ShoppingCart className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                        {(inv.order_id || inv.converted_order_id) && (
                          <Button size="sm" variant="ghost" title="Voir les commandes" onClick={() => navigate('/admin/orders')}>
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin && inv.status === 'issued' && (
                          <Button size="sm" variant="ghost" title="Annuler" disabled={busyId === inv.id} onClick={() => cancelInvoice(inv)}>
                            <XCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Facturer une commande ── */}
      <Dialog open={orderInvOpen} onOpenChange={setOrderInvOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Facturer une commande</DialogTitle>
            <DialogDescription>
              Le type (acompte ou définitive) et le contenu découlent de la commande. La facture n'est jamais figée :
              elle est recalculée à chaque impression.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {!invOrder ? (
              <div className="space-y-2">
                <Input placeholder="Rechercher par n° de commande, client ou téléphone…" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
                {ordersLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : orderResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Aucune commande.</p>
                ) : (
                  <div className="border rounded divide-y">
                    {orderResults.map(o => (
                      <button key={o.id} type="button" className="w-full flex justify-between items-center gap-3 px-3 py-2 text-sm text-left hover:bg-muted" onClick={() => selectOrder(o)}>
                        <span>
                          <span className="font-medium">{orderLabel(o)}</span>
                          <span className="text-muted-foreground"> · {orderClientName(o)} · {formatDate(o.placed_at)}</span>
                        </span>
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          {paymentBadge(o)}
                          {formatCurrency(Number(o.total_amount))}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border rounded px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{orderLabel(invOrder)}</span> · {orderClientName(invOrder)}
                    <div className="text-xs text-muted-foreground">
                      Commande : {ORDER_STATUS_LABELS[invOrder.status] || invOrder.status}
                    </div>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setInvOrder(null)}>Changer</Button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded border p-2">
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="font-semibold">{formatCurrency(Number(invOrder.total_amount))}</div>
                  </div>
                  <div className="rounded border p-2">
                    <div className="text-xs text-muted-foreground">Payé</div>
                    <div className="font-semibold text-emerald-700">{formatCurrency(paidOf(invOrder))}</div>
                  </div>
                  <div className="rounded border p-2">
                    <div className="text-xs text-muted-foreground">Reste à payer</div>
                    <div className="font-semibold text-amber-700">{formatCurrency(remainingOf(invOrder))}</div>
                  </div>
                </div>

                {invType ? (
                  <p className="text-sm">
                    Facture générée : <strong>{invType === 'definitive' ? 'Facture définitive (payée)' : "Facture d'acompte (non payée)"}</strong>
                    {reusable && <> — déjà émise ({reusable.invoice_number}), elle sera réimprimée à jour avec le même numéro.</>}
                  </p>
                ) : (
                  <p className="text-sm text-amber-700">
                    Aucun paiement enregistré sur cette commande. Enregistrez un versement via « Finaliser la commande » dans Commandes, ou émettez une proforma.
                  </p>
                )}

                {orderInvoices.length > 0 && (
                  <div>
                    <Label className="font-semibold mb-2 block">Facture de cette commande</Label>
                    <div className="space-y-1">
                      {orderInvoices.map(inv => (
                        <div key={inv.id} className="flex items-center justify-between text-sm border rounded px-2 py-1.5">
                          <span>
                            <span className="font-medium">{inv.invoice_number}</span>
                            {' · '}{INVOICE_TYPE_LABELS[inv.invoice_type]}
                            {inv.invoice_type === 'acompte' && ` · payé ${formatCurrency(Number(inv.acompte_amount || 0))}`}
                            {inv.status === 'cancelled' && <Badge variant="outline" className="ml-2">Annulée</Badge>}
                          </span>
                          <Button size="sm" variant="ghost" onClick={() => printInvoice(inv)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderInvOpen(false)}>Fermer</Button>
            <Button onClick={generateOrderInvoice} disabled={!invOrder || !invType || generating}>
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {reusable ? 'Réimprimer' : 'Générer la facture'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Nouvelle proforma ── */}
      <Dialog open={proformaOpen} onOpenChange={setProformaOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle facture proforma</DialogTitle>
            <DialogDescription>Indépendante de toute commande. Elle pourra ensuite être transformée en commande.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="font-semibold">Client</Label>
              {selectedClient ? (
                <div className="flex items-center justify-between border rounded px-3 py-2 text-sm">
                  <span>{selectedClient.full_name} {selectedClient.phone && <span className="text-muted-foreground">· {selectedClient.phone}</span>}</span>
                  <Button size="sm" variant="ghost" onClick={() => setClientId('')}>Changer</Button>
                </div>
              ) : (
                <>
                  <Input placeholder="Rechercher un client existant…" value={clientSearch} onChange={e => setClientSearch(e.target.value)} />
                  {clientResults.length > 0 && (
                    <div className="border rounded divide-y">
                      {clientResults.map(c => (
                        <button key={c.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                          onClick={() => { setClientId(c.id); setClientSearch(''); }}>
                          {c.full_name || '—'} <span className="text-muted-foreground">{c.phone} {c.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Ou saisissez un prospect (non enregistré comme client) :</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input placeholder="Nom" value={freeClient.name} onChange={e => setFreeClient({ ...freeClient, name: e.target.value })} />
                    <Input placeholder="Téléphone" value={freeClient.phone} onChange={e => setFreeClient({ ...freeClient, phone: e.target.value })} />
                    <Input placeholder="Email (facultatif)" value={freeClient.email} onChange={e => setFreeClient({ ...freeClient, email: e.target.value })} />
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Articles</Label>
              <div className="flex gap-2">
                <Input placeholder="Rechercher un produit ou un service…" value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} />
                <Button type="button" variant="outline" onClick={addFreeLine}><Plus className="mr-1 h-4 w-4" /> Ligne libre</Button>
              </div>
              {catalogResults.length > 0 && (
                <div className="border rounded divide-y">
                  {catalogResults.map(r => (
                    <button key={`${r.kind}-${r.id}`} type="button" className="w-full flex justify-between px-3 py-2 text-sm hover:bg-muted" onClick={() => addLine(r)}>
                      <span>{r.name} <span className="text-muted-foreground text-xs">· {r.extra}</span></span>
                      <span>{formatCurrency(r.price)}</span>
                    </button>
                  ))}
                </div>
              )}

              {lines.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Désignation</TableHead>
                      <TableHead className="w-20">Qté</TableHead>
                      <TableHead className="w-32">P.U.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map(l => (
                      <TableRow key={l.key}>
                        <TableCell>
                          {l.product_id || l.service_id ? l.name : (
                            <Input placeholder="Désignation" value={l.name} onChange={e => updateLine(l.key, { name: e.target.value })} />
                          )}
                        </TableCell>
                        <TableCell>
                          <Input type="number" min={1} value={l.quantity}
                            onChange={e => updateLine(l.key, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min={0} value={l.unit_price}
                            onChange={e => updateLine(l.key, { unit_price: Math.max(0, Number(e.target.value) || 0) })} />
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatCurrency(l.quantity * l.unit_price)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => setLines(prev => prev.filter(x => x.key !== l.key))}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pf-discount">Remise (F CFA)</Label>
                <Input id="pf-discount" type="number" min={0} value={discount} onChange={e => setDiscount(Math.max(0, Number(e.target.value) || 0))} />
              </div>
              <div className="flex flex-col justify-end text-right text-sm">
                <div className="text-muted-foreground">Sous-total : {formatCurrency(subtotal)}</div>
                <div className="text-lg font-semibold">Total : {formatCurrency(total)}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pf-notes">Note</Label>
              <Textarea id="pf-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProformaOpen(false)}>Annuler</Button>
            <Button onClick={saveProforma} disabled={savingProforma}>
              {savingProforma && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer la proforma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Transformation en commande ── */}
      <Dialog open={!!convertInvoice} onOpenChange={open => { if (!open) setConvertInvoice(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Transformer en commande</DialogTitle>
            <DialogDescription>
              La proforma {convertInvoice?.invoice_number} devient une commande en attente, avec les mêmes articles, prix et remise.
              Le stock des produits est vérifié à cette étape.
            </DialogDescription>
          </DialogHeader>
          {convertInvoice && (
            <div className="text-sm space-y-1 py-2">
              <div><span className="text-muted-foreground">Client :</span> {convertInvoice.client?.name || convertInvoice.client?.phone}</div>
              {convertInvoice.items.map((it, i) => (
                <div key={i} className="flex justify-between">
                  <span>{it.name} × {it.quantity}</span>
                  <span>{formatCurrency(it.total)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold border-t pt-1">
                <span>Total</span><span>{formatCurrency(Number(convertInvoice.total_amount))}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertInvoice(null)}>Annuler</Button>
            <Button onClick={confirmConvert} disabled={converting}>
              {converting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer la commande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Invoices;
