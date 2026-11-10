// Admin · liste des funnels promo (/admin/funnels) — réservé aux admins
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Megaphone, Plus, Settings, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { adminFunnelApi, fmtPrice, STATE_LABELS, STATE_STYLES, type AdminFunnel, type FunnelState } from '@/lib/funnels';

const FILTERS: Array<{ key: 'all' | FunnelState; label: string }> = [
  { key: 'all', label: 'Tous' },
  { key: 'online', label: 'En ligne' },
  { key: 'scheduled', label: 'Programmés' },
  { key: 'draft', label: 'Brouillons' },
  { key: 'ended', label: 'Terminés' },
];

const shortDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : null);
const fmtMoney = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M F` : fmtPrice(n));

export default function Funnels() {
  const navigate = useNavigate();
  const [funnels, setFunnels] = useState<AdminFunnel[] | null>(null);
  const [summary, setSummary] = useState<{ online: number; orders_30d: number; to_process: number; revenue_30d: number } | null>(null);
  const [filter, setFilter] = useState<'all' | FunnelState>('all');

  useEffect(() => {
    Promise.all([adminFunnelApi.list(), adminFunnelApi.summary()])
      .then(([list, s]) => { setFunnels(list); setSummary(s); })
      .catch((e) => { toast.error(e.message); setFunnels([]); });
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: funnels?.length || 0 };
    (funnels || []).forEach((f) => { c[f.state] = (c[f.state] || 0) + 1; });
    return c;
  }, [funnels]);
  const shown = (funnels || []).filter((f) => filter === 'all' || f.state === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Megaphone className="h-6 w-6 text-blue-600" /> Funnels promo</h1>
          <p className="text-sm text-muted-foreground">Une page de vente dédiée par promo, avec paiement Wave, Orange Money ou à la livraison.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/admin/funnels/paiement"><Settings className="h-4 w-4 mr-2" />Réglages paiement</Link></Button>
          <Button asChild><Link to="/admin/funnels/nouveau"><Plus className="h-4 w-4 mr-2" />Nouveau funnel</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Funnels en ligne', value: summary?.online ?? '—' },
          { label: 'Commandes (30 j)', value: summary?.orders_30d ?? '—' },
          { label: 'À traiter', value: summary?.to_process ?? '—', alert: (summary?.to_process || 0) > 0 },
          { label: 'CA promo confirmé (30 j)', value: summary ? fmtMoney(summary.revenue_30d) : '—' },
        ].map((c) => (
          <Card key={c.label} className={c.alert ? 'border-orange-200 bg-orange-50' : ''}>
            <CardContent className="p-5">
              <p className={`text-sm ${c.alert ? 'text-orange-700' : 'text-muted-foreground'}`}>{c.label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.alert ? 'text-orange-600' : ''}`}>{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-sm font-medium ${filter === f.key ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white hover:bg-muted'}`}>
            {f.label} · {counts[f.key] || 0}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {funnels === null ? (
            <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : shown.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <p className="text-muted-foreground">{funnels.length === 0 ? 'Aucun funnel pour le moment.' : 'Aucun funnel dans cette catégorie.'}</p>
              {funnels.length === 0 && <Button asChild><Link to="/admin/funnels/nouveau"><Plus className="h-4 w-4 mr-2" />Créer le premier funnel</Link></Button>}
            </div>
          ) : (
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Funnel</th>
                  <th className="text-left font-semibold px-4 py-3">Période</th>
                  <th className="text-left font-semibold px-4 py-3">Statut</th>
                  <th className="text-right font-semibold px-4 py-3">Visites</th>
                  <th className="text-left font-semibold px-4 py-3">Commandes</th>
                  <th className="text-right font-semibold px-4 py-3">Conv.</th>
                  <th className="text-right font-semibold px-4 py-3">Stock promo</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((f) => {
                  const start = shortDate(f.starts_at);
                  const end = shortDate(f.ends_at);
                  const conv = f.visits > 0 ? `${((f.orders_count / f.visits) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %` : '—';
                  return (
                    <tr key={f.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/admin/funnels/${f.id}/commandes`)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded bg-muted overflow-hidden shrink-0">{f.image && <img src={f.image} alt="" className="h-full w-full object-cover" />}</div>
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{f.title}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">/promo/{f.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{start || end ? `${start || '…'} → ${end || '…'}` : '—'}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATE_STYLES[f.state]}`}>{STATE_LABELS[f.state]}</span></td>
                      <td className="px-4 py-3 text-right tabular-nums">{f.visits || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {f.orders_count || '—'}
                        {f.to_process > 0 && <span className="ml-1.5 text-xs font-semibold text-orange-600">· {f.to_process} à traiter</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{conv}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{Math.max(0, f.promo_stock - f.held)} / {f.promo_stock}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {f.state !== 'draft' && (
                          <a href={`/promo/${f.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex p-1.5 text-muted-foreground hover:text-foreground" aria-label="Voir la page">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        <Link to={`/admin/funnels/${f.id}`} className="ml-2 font-semibold text-blue-600 hover:underline">Modifier</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
