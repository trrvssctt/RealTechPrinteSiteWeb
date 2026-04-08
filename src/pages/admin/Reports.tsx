import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  FileBarChart2, Download, RefreshCw, Loader2, Send, Plus,
  FileSpreadsheet, FileText, FileClock, Calendar, User,
  ChevronLeft, ChevronRight, Search, Filter, CheckCircle,
  Mail, Clock, BarChart3, Layers,
  AlertCircle, Package, ShoppingCart, TrendingDown,
} from 'lucide-react';

const ITEMS_PER_PAGE = 15;

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  journalier:  { label: 'Journalier',  color: 'bg-blue-100 text-blue-800' },
  mensuelle:   { label: 'Mensuel',     color: 'bg-purple-100 text-purple-800' },
  annuelle:    { label: 'Annuel',      color: 'bg-indigo-100 text-indigo-800' },
  personnalise:{ label: 'Personnalisé',color: 'bg-orange-100 text-orange-800' },
};

const FORMAT_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  xls:  { label: 'XLSX', color: 'bg-emerald-100 text-emerald-800', icon: FileSpreadsheet },
  xlsx: { label: 'XLSX', color: 'bg-emerald-100 text-emerald-800', icon: FileSpreadsheet },
  csv:  { label: 'CSV',  color: 'bg-sky-100 text-sky-800',         icon: FileText },
  pdf:  { label: 'PDF',  color: 'bg-red-100 text-red-800',         icon: FileText },
};

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string, withTime = false) {
  try {
    return format(new Date(iso), withTime ? "dd MMM yyyy 'à' HH:mm" : 'dd MMM yyyy', { locale: fr });
  } catch { return '—'; }
}

function periodFromParams(params: any): string {
  if (!params) return '—';
  const s = params.start || params.date_debut;
  const e = params.end   || params.date_fin;
  if (!s) return '—';
  const start = format(new Date(s), 'dd/MM/yyyy');
  const end   = e ? format(new Date(e), 'dd/MM/yyyy') : 'maintenant';
  return `${start} → ${end}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ── CSV/Excel client-side export ─────────────────────────────────────────────

function downloadCSV(rows: any[][], filename: string) {
  const csv = rows.map(r =>
    r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Component ─────────────────────────────────────────────────────────────────

const Reports = () => {
  const [rapports, setRapports] = useState<any[]>([]);
  const [loading, setLoading]   = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // filters
  const [search,      setSearch]      = useState('');
  const [filterType,  setFilterType]  = useState('all');
  const [filterFmt,   setFilterFmt]   = useState('all');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd,   setFilterEnd]   = useState('');

  // daily report dialog
  const [dailyOpen,  setDailyOpen]  = useState(false);
  const [dailyDate,  setDailyDate]  = useState(todayISO());
  const [dailySending, setDailySending] = useState(false);

  // generate custom dialog
  const [genOpen,    setGenOpen]    = useState(false);
  const [genType,    setGenType]    = useState('journalier');
  const [genFmt,     setGenFmt]     = useState('xls');
  const [genStart,   setGenStart]   = useState(todayISO());
  const [genEnd,     setGenEnd]     = useState(todayISO());
  const [genSources, setGenSources] = useState({ ventes: true, stock: true, depenses: true });
  const [generating, setGenerating] = useState(false);

  useEffect(() => { fetchRapports(); }, []);

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchRapports = async () => {
    setLoading(true);
    try {
      const resp = await apiFetch('/api/admin/rapports?limit=500');
      if (!resp.ok) throw new Error();
      const j = await resp.json();
      setRapports(Array.isArray(j.data) ? j.data : []);
    } catch {
      toast.error('Impossible de charger les rapports');
    } finally {
      setLoading(false);
    }
  };

  // ── Filters ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = [...rapports];
    if (filterType !== 'all') list = list.filter(r => r.type_rapport === filterType);
    if (filterFmt  !== 'all') list = list.filter(r => (r.format_rapport || '').startsWith(filterFmt));
    if (filterStart) list = list.filter(r => new Date(r.created_at) >= new Date(filterStart));
    if (filterEnd)   list = list.filter(r => new Date(r.created_at) <= new Date(filterEnd + 'T23:59:59'));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.user_name || '').toLowerCase().includes(q) ||
        (r.type_rapport || '').includes(q) ||
        (r.format_rapport || '').includes(q)
      );
    }
    return list;
  }, [rapports, filterType, filterFmt, filterStart, filterEnd, search]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const page = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // ── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = rapports.filter(r => {
      const d = new Date(r.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const lastRapport = rapports[0];
    const formats = rapports.reduce((acc, r) => {
      const f = r.format_rapport || 'inconnu';
      acc[f] = (acc[f] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const topFmt = (Object.entries(formats) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
    return { total: rapports.length, thisMonth: thisMonth.length, lastRapport, topFmt };
  }, [rapports]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const sendDailyReport = async () => {
    setDailySending(true);
    try {
      const resp = await apiFetch('/api/admin/rapport-journalier/envoyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dailyDate }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur serveur');
      }
      toast.success('Rapport journalier envoyé par email !', {
        description: `Rapport du ${fmtDate(dailyDate)} envoyé avec succès`,
      });
      setDailyOpen(false);
      fetchRapports();
    } catch (e: any) {
      toast.error('Échec de l\'envoi', { description: e?.message });
    } finally {
      setDailySending(false);
    }
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const params: any = {};
      if (genType === 'journalier') {
        params.start = genStart;
        params.end   = genStart;
      } else {
        params.start = genStart;
        params.end   = genEnd;
      }

      const resp = await apiFetch('/api/admin/rapports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type_rapport:   genType,
          format_rapport: genFmt,
          parameters:     { ...params, sources: genSources },
        }),
      });
      if (!resp.ok) throw new Error();
      const body = await resp.json();
      const downloadUrl = body.download;

      toast.success('Rapport généré avec succès !');

      // Téléchargement via apiFetch pour inclure le token d'auth
      if (downloadUrl) {
        try {
          const dlResp = await apiFetch(downloadUrl);
          if (dlResp.ok) {
            const blob = await dlResp.blob();
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = body.data?.filename || 'rapport';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        } catch {
          toast.warning('Le rapport a été généré mais le téléchargement automatique a échoué. Cherchez-le dans l\'historique.');
        }
      }

      setGenOpen(false);
      fetchRapports();
    } catch {
      toast.error('Erreur lors de la génération du rapport');
    } finally {
      setGenerating(false);
    }
  };

  const downloadRapport = async (rapport: any) => {
    if (!rapport.filename) {
      toast.error('Aucun fichier disponible pour ce rapport');
      return;
    }
    try {
      const resp = await apiFetch(`/api/admin/rapports/download/${rapport.filename}`);
      if (!resp.ok) {
        if (resp.status === 404) {
          toast.error('Fichier introuvable sur le serveur', {
            description: 'Il a peut-être été supprimé ou déplacé.',
          });
        } else {
          toast.error(`Erreur ${resp.status} lors du téléchargement`);
        }
        return;
      }
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = rapport.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Téléchargement démarré', { description: rapport.filename });
    } catch {
      toast.error('Impossible de télécharger le fichier');
    }
  };

  // Quick CSV export of the current filtered list
  const exportListCSV = () => {
    if (filtered.length === 0) { toast.error('Aucun rapport à exporter'); return; }
    const rows = [
      ['Date', 'Type', 'Format', 'Période', 'Lignes', 'Généré par', 'Fichier'],
      ...filtered.map(r => [
        fmtDate(r.created_at, true),
        TYPE_LABELS[r.type_rapport]?.label || r.type_rapport || '—',
        (FORMAT_LABELS[r.format_rapport]?.label || r.format_rapport || '—'),
        periodFromParams(r.parameters),
        r.rows_count ?? '—',
        r.user_name || 'Système',
        r.filename || '—',
      ]),
    ];
    downloadCSV(rows, `historique_rapports_${todayISO()}.csv`);
    toast.success(`${filtered.length} lignes exportées`);
  };

  const resetFilters = () => {
    setSearch(''); setFilterType('all'); setFilterFmt('all');
    setFilterStart(''); setFilterEnd(''); setCurrentPage(1);
  };

  const hasFilters = search || filterType !== 'all' || filterFmt !== 'all' || filterStart || filterEnd;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
            <FileBarChart2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Rapports & Exports</h1>
            <p className="text-muted-foreground mt-0.5">
              Historique des rapports générés, envoi manuel et exports personnalisés
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchRapports} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button variant="outline" size="sm" onClick={exportListCSV} disabled={filtered.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Exporter liste
          </Button>
          <Button variant="outline" onClick={() => setGenOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Rapport personnalisé
          </Button>
          <Button onClick={() => setDailyOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Send className="mr-2 h-4 w-4" />
            Rapport journalier
          </Button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total rapports</p>
                <p className="text-3xl font-bold mt-1">{stats.total}</p>
                <p className="text-xs text-muted-foreground mt-1">Tous types confondus</p>
              </div>
              <div className="w-11 h-11 rounded-lg bg-violet-100 flex items-center justify-center">
                <FileBarChart2 className="h-5 w-5 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Ce mois-ci</p>
                <p className="text-3xl font-bold mt-1 text-indigo-600">{stats.thisMonth}</p>
                <p className="text-xs text-muted-foreground mt-1">Rapports générés</p>
              </div>
              <div className="w-11 h-11 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Dernier rapport</p>
                <p className="text-base font-bold mt-1 leading-tight">
                  {stats.lastRapport ? fmtDate(stats.lastRapport.created_at) : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.lastRapport
                    ? (TYPE_LABELS[stats.lastRapport.type_rapport]?.label || stats.lastRapport.type_rapport)
                    : 'Aucun rapport'}
                </p>
              </div>
              <div className="w-11 h-11 rounded-lg bg-blue-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Format principal</p>
                <p className="text-3xl font-bold mt-1 text-emerald-600 uppercase">
                  {stats.topFmt ? FORMAT_LABELS[stats.topFmt[0]]?.label || stats.topFmt[0] : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.topFmt ? `${stats.topFmt[1]} rapport${stats.topFmt[1] > 1 ? 's' : ''}` : ''}
                </p>
              </div>
              <div className="w-11 h-11 rounded-lg bg-emerald-100 flex items-center justify-center">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters ── */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-col md:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par utilisateur, type..."
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                className="pl-10"
              />
            </div>

            <Select value={filterType} onValueChange={v => { setFilterType(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[170px]">
                <Layers className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="journalier">Journalier</SelectItem>
                <SelectItem value="mensuelle">Mensuel</SelectItem>
                <SelectItem value="annuelle">Annuel</SelectItem>
                <SelectItem value="personnalise">Personnalisé</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterFmt} onValueChange={v => { setFilterFmt(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[150px]">
                <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous formats</SelectItem>
                <SelectItem value="xls">XLSX</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={filterStart}
                  onChange={e => { setFilterStart(e.target.value); setCurrentPage(1); }}
                  className="pl-10 w-[155px]"
                  title="Date début"
                />
              </div>
              <span className="text-muted-foreground text-sm">→</span>
              <Input
                type="date"
                value={filterEnd}
                onChange={e => { setFilterEnd(e.target.value); setCurrentPage(1); }}
                className="w-[145px]"
                title="Date fin"
              />
            </div>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Réinitialiser
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Table ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Historique des rapports</CardTitle>
              <CardDescription>
                {filtered.length} rapport{filtered.length !== 1 ? 's' : ''} trouvé{filtered.length !== 1 ? 's' : ''}
                {hasFilters && ' (filtrés)'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-8 w-24 rounded-md" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <FileClock className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-lg mb-1">Aucun rapport trouvé</h3>
              <p className="text-muted-foreground text-sm mb-6">
                {hasFilters
                  ? 'Essayez de modifier vos filtres'
                  : 'Aucun rapport généré pour le moment. Cliquez sur "Rapport journalier" pour commencer.'}
              </p>
              {!hasFilters && (
                <Button onClick={() => setDailyOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
                  <Send className="mr-2 h-4 w-4" />
                  Envoyer le rapport journalier
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Date & heure</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Période couverte</TableHead>
                      <TableHead className="text-center">Lignes</TableHead>
                      <TableHead>Généré par</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.map(r => {
                      const typeInfo   = TYPE_LABELS[r.type_rapport]   || { label: r.type_rapport || '—', color: 'bg-gray-100 text-gray-700' };
                      const fmtInfo    = FORMAT_LABELS[r.format_rapport] || { label: r.format_rapport || '—', color: 'bg-gray-100 text-gray-700', icon: FileText };
                      const FmtIcon    = fmtInfo.icon;
                      const hasFile    = Boolean(r.filename);

                      return (
                        <TableRow key={r.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="font-medium text-sm">
                              {fmtDate(r.created_at)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(r.created_at), 'HH:mm', { locale: fr })}
                            </div>
                          </TableCell>

                          <TableCell>
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1 ${typeInfo.color}`}>
                              <BarChart3 className="h-3 w-3" />
                              {typeInfo.label}
                            </span>
                          </TableCell>

                          <TableCell>
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1 ${fmtInfo.color}`}>
                              <FmtIcon className="h-3 w-3" />
                              {fmtInfo.label}
                            </span>
                          </TableCell>

                          <TableCell>
                            <span className="text-sm text-muted-foreground font-mono text-xs">
                              {periodFromParams(
                                typeof r.parameters === 'string'
                                  ? JSON.parse(r.parameters)
                                  : r.parameters
                              )}
                            </span>
                          </TableCell>

                          <TableCell className="text-center">
                            {r.rows_count != null ? (
                              <span className="font-semibold">{r.rows_count.toLocaleString()}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <User className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate max-w-[120px]">
                                {r.user_name || 'Système (auto)'}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="text-right">
                            <Button
                              variant={hasFile ? 'outline' : 'ghost'}
                              size="sm"
                              disabled={!hasFile}
                              onClick={() => downloadRapport(r)}
                              title={hasFile ? 'Télécharger le fichier' : 'Fichier non disponible'}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              {hasFile ? 'Télécharger' : 'Indisponible'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} sur {filtered.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let n = i + 1;
                      if (totalPages > 5) {
                        if (currentPage <= 3) n = i + 1;
                        else if (currentPage >= totalPages - 2) n = totalPages - 4 + i;
                        else n = currentPage - 2 + i;
                      }
                      return (
                        <Button key={n} variant={currentPage === n ? 'default' : 'outline'} size="sm" className="w-8 h-8 p-0" onClick={() => setCurrentPage(n)}>
                          {n}
                        </Button>
                      );
                    })}
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Daily Report Dialog ── */}
      <Dialog open={dailyOpen} onOpenChange={setDailyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-emerald-600" />
              Envoyer le rapport journalier
            </DialogTitle>
            <DialogDescription>
              Génère et envoie le rapport Excel du jour par email (ventes + stock + dépenses).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Destination info */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <Mail className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-800">Destinataire configuré</p>
                <p className="text-xs text-emerald-700 mt-0.5">diankaseydou52@gmail.com</p>
                <p className="text-xs text-emerald-600 mt-1">Le rapport automatique est aussi envoyé chaque soir à 22h00.</p>
              </div>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label>Date du rapport</Label>
              <Input
                type="date"
                value={dailyDate}
                max={todayISO()}
                onChange={e => setDailyDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Le rapport inclura toutes les opérations de la journée sélectionnée.
              </p>
            </div>

            {/* Content reminder */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: ShoppingCart, label: 'Ventes', color: 'text-blue-600 bg-blue-50' },
                { icon: Package,      label: 'Stock',  color: 'text-emerald-600 bg-emerald-50' },
                { icon: TrendingDown, label: 'Dépenses', color: 'text-red-600 bg-red-50' },
              ].map(({ icon: Icon, label, color }) => (
                <div key={label} className={`flex flex-col items-center gap-1 p-2.5 rounded-lg ${color.split(' ')[1]} text-center`}>
                  <Icon className={`h-5 w-5 ${color.split(' ')[0]}`} />
                  <span className={`text-xs font-medium ${color.split(' ')[0]}`}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDailyOpen(false)}>Annuler</Button>
            <Button
              onClick={sendDailyReport}
              disabled={dailySending || !dailyDate}
              className="bg-emerald-600 hover:bg-emerald-700 min-w-36"
            >
              {dailySending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi en cours...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" />Envoyer le rapport</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Generate Custom Report Dialog ── */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-violet-600" />
              Générer un rapport personnalisé
            </DialogTitle>
            <DialogDescription>
              Choisissez la période, le contenu et le format du rapport à générer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Type */}
            <div className="space-y-1.5">
              <Label>Type de rapport</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { val: 'journalier',   label: 'Journalier' },
                  { val: 'mensuelle',    label: 'Mensuel' },
                  { val: 'annuelle',     label: 'Annuel' },
                  { val: 'personnalise', label: 'Personnalisé' },
                ].map(({ val, label }) => (
                  <button
                    key={val}
                    onClick={() => setGenType(val)}
                    className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      genType === val
                        ? 'border-violet-500 bg-violet-50 text-violet-700'
                        : 'border-muted text-muted-foreground hover:border-violet-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className={`grid gap-3 ${genType === 'journalier' ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <div className="space-y-1.5">
                <Label>{genType === 'journalier' ? 'Date' : 'Du'}</Label>
                <Input
                  type="date"
                  value={genStart}
                  max={todayISO()}
                  onChange={e => setGenStart(e.target.value)}
                />
              </div>
              {genType !== 'journalier' && (
                <div className="space-y-1.5">
                  <Label>Au</Label>
                  <Input
                    type="date"
                    value={genEnd}
                    min={genStart}
                    max={todayISO()}
                    onChange={e => setGenEnd(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Sources */}
            <div className="space-y-1.5">
              <Label>Données à inclure</Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { key: 'ventes',   label: 'Ventes',   icon: ShoppingCart, color: 'border-blue-300 bg-blue-50 text-blue-700' },
                  { key: 'stock',    label: 'Stock',    icon: Package,      color: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
                  { key: 'depenses', label: 'Dépenses', icon: TrendingDown, color: 'border-red-300 bg-red-50 text-red-700' },
                ].map(({ key, label, icon: Icon, color }) => {
                  const active = genSources[key as keyof typeof genSources];
                  return (
                    <button
                      key={key}
                      onClick={() => setGenSources(s => ({ ...s, [key]: !s[key as keyof typeof s] }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                        active ? color : 'border-muted text-muted-foreground opacity-50'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                      {active && <CheckCircle className="h-3.5 w-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Format */}
            <div className="space-y-1.5">
              <Label>Format d'export</Label>
              <div className="flex gap-2">
                {[
                  { val: 'xls', label: 'Excel (.xlsx)', icon: FileSpreadsheet, color: 'border-emerald-400 bg-emerald-50 text-emerald-700' },
                  { val: 'csv', label: 'CSV',           icon: FileText,        color: 'border-sky-400 bg-sky-50 text-sky-700' },
                ].map(({ val, label, icon: Icon, color }) => (
                  <button
                    key={val}
                    onClick={() => setGenFmt(val)}
                    className={`flex items-center gap-2 flex-1 py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      genFmt === val ? color : 'border-muted text-muted-foreground hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Le rapport sera généré côté serveur et disponible en téléchargement immédiat. Il sera également archivé dans l'historique.</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Annuler</Button>
            <Button
              onClick={generateReport}
              disabled={generating || !genStart}
              className="min-w-40"
            >
              {generating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Génération...</>
              ) : (
                <><Download className="mr-2 h-4 w-4" />Générer et télécharger</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reports;
