import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import {
  Plus, RefreshCw, CheckCircle, XCircle, Ban,
  Filter, TrendingDown, Clock, AlertTriangle, User,
  Calendar, Tag, FileText, Shield, Eye,
} from 'lucide-react';
// ─── Types ────────────────────────────────────────────────────────────────────

type Statut = 'en_attente' | 'valide' | 'rejete' | 'annule';

interface Depense {
  id: string;
  description: string;
  montant: number;
  categorie: string;
  justification: string | null;
  statut: Statut;
  commentaire_admin: string | null;
  created_by: string | null;
  employe_name: string | null;
  employe_email: string | null;
  created_at: string;
  validated_by: string | null;
  validateur_name: string | null;
  validated_at: string | null;
}

interface Totaux {
  statut: Statut;
  nb: string;
  total: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<Statut, { label: string; color: string; icon: React.ReactNode }> = {
  en_attente: {
    label: 'En attente',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <Clock className="w-3 h-3" />,
  },
  valide: {
    label: 'Validée',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  rejete: {
    label: 'Rejetée',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: <XCircle className="w-3 h-3" />,
  },
  annule: {
    label: 'Annulée',
    color: 'bg-gray-100 text-gray-500 border-gray-200',
    icon: <Ban className="w-3 h-3" />,
  },
};

const fmtMontant = (v: number | string) =>
  Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' FCFA';

const fmtDate = (d: string) =>
  new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const today = () => new Date().toISOString().slice(0, 10);

// ─── Composant principal ──────────────────────────────────────────────────────

const DepensesPage = () => {
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [totaux, setTotaux] = useState<Totaux[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Rôle utilisateur courant
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Filtres
  const [dateDebut, setDateDebut] = useState(today());
  const [dateFin, setDateFin] = useState(today());
  const [filtreStatut, setFiltreStatut] = useState<string>('tous');
  const [filtreCategorie, setFiltreCategorie] = useState<string>('tous');
  const [filtreEmploye, setFiltreEmploye] = useState<string>('');

  // Dialogs
  const [openAjouter, setOpenAjouter] = useState(false);
  const [openDetail, setOpenDetail] = useState<Depense | null>(null);
  const [openRejeter, setOpenRejeter] = useState<Depense | null>(null);
  const [openAnnuler, setOpenAnnuler] = useState<Depense | null>(null);
  const [commentaire, setCommentaire] = useState('');

  // Formulaire nouvelle dépense
  const [form, setForm] = useState({
    description: '',
    montant: '',
    categorie: '',
    justification: '',
  });
  const [saving, setSaving] = useState(false);

  // ─── Chargement utilisateur ────────────────────────────────────────────────

  useEffect(() => {
    apiFetch('/api/users/me').then(async (r) => {
      if (!r.ok) return;
      const body = await r.json();
      const u = body.user || body;
      setCurrentUser(u);
      const roles: string[] = (u.roles || [u.role_name || '']).map((s: string) => (s || '').toLowerCase());
      setIsAdmin(roles.includes('admin'));
    }).catch(() => {});
  }, []);

  // ─── Chargement dépenses ───────────────────────────────────────────────────

  const fetchDepenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateDebut) params.set('date_debut', dateDebut);
      if (dateFin)   params.set('date_fin',   dateFin);
      if (filtreStatut !== 'tous')     params.set('statut',     filtreStatut);
      if (filtreCategorie !== 'tous') params.set('categorie', filtreCategorie);
      params.set('limit', '500');

      const r = await apiFetch(`/api/admin/depenses?${params}`);
      if (!r.ok) throw new Error('Erreur chargement');
      const body = await r.json();

      let data: Depense[] = body.data || [];

      // Filtre employé côté client (le nom est en clair)
      if (filtreEmploye.trim()) {
        const q = filtreEmploye.toLowerCase();
        data = data.filter(d =>
          (d.employe_name || '').toLowerCase().includes(q) ||
          (d.employe_email || '').toLowerCase().includes(q)
        );
      }

      setDepenses(data);
      setTotaux(body.totaux || []);
      if (body.categories?.length) setCategories(body.categories);
    } catch {
      toast.error('Impossible de charger les dépenses');
    } finally {
      setLoading(false);
    }
  }, [dateDebut, dateFin, filtreStatut, filtreCategorie, filtreEmploye]);

  useEffect(() => { fetchDepenses(); }, [fetchDepenses]);

  // ─── Statistiques ──────────────────────────────────────────────────────────

  const getTotal = (statut?: Statut) => {
    if (!statut) {
      return totaux.filter(t => t.statut !== 'annule').reduce((s, t) => s + parseFloat(t.total), 0);
    }
    return parseFloat(totaux.find(t => t.statut === statut)?.total || '0');
  };

  const getNb = (statut: Statut) => parseInt(totaux.find(t => t.statut === statut)?.nb || '0');

  // ─── Actions admin ─────────────────────────────────────────────────────────

  const handleValider = async (d: Depense) => {
    try {
      const r = await apiFetch(`/api/admin/depenses/${d.id}/valider`, { method: 'PATCH' });
      if (!r.ok) throw new Error((await r.json()).error);
      toast.success('Dépense validée');
      fetchDepenses();
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de la validation');
    }
  };

  const handleRejeter = async () => {
    if (!openRejeter) return;
    if (!commentaire.trim()) { toast.error('Veuillez saisir un motif de rejet'); return; }
    try {
      const r = await apiFetch(`/api/admin/depenses/${openRejeter.id}/rejeter`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentaire }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      toast.success('Dépense rejetée');
      setOpenRejeter(null);
      setCommentaire('');
      fetchDepenses();
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    }
  };

  const handleAnnuler = async () => {
    if (!openAnnuler) return;
    try {
      const r = await apiFetch(`/api/admin/depenses/${openAnnuler.id}/annuler`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentaire: commentaire || undefined }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      toast.success('Dépense annulée');
      setOpenAnnuler(null);
      setCommentaire('');
      fetchDepenses();
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    }
  };

  // ─── Création dépense ──────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!form.description.trim()) { toast.error('Description obligatoire'); return; }
    if (!form.categorie)          { toast.error('Veuillez choisir une catégorie'); return; }
    const mt = parseFloat(form.montant);
    if (isNaN(mt) || mt <= 0)    { toast.error('Montant invalide (doit être > 0)'); return; }

    setSaving(true);
    try {
      const r = await apiFetch('/api/admin/depenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, montant: mt }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Erreur');
      toast.success('Dépense enregistrée — en attente de validation');
      setOpenAjouter(false);
      setForm({ description: '', montant: '', categorie: '', justification: '' });
      fetchDepenses();
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  // ─── Rendu badge statut ────────────────────────────────────────────────────

  const StatutBadge = ({ statut }: { statut: Statut }) => {
    const cfg = STATUT_CONFIG[statut];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
        {cfg.icon} {cfg.label}
      </span>
    );
  };

  // ─── Rendu ────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

        {/* En-tête */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingDown className="w-6 h-6 text-red-600" />
              Dépenses
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {isAdmin
                ? 'Validez ou rejetez les dépenses déclarées par les employés.'
                : 'Déclarez une dépense — elle sera examinée par l\'administrateur avant validation.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchDepenses} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Button size="sm" onClick={() => setOpenAjouter(true)} className="bg-red-600 hover:bg-red-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle dépense
            </Button>
          </div>
        </div>

        {/* Bandeau anti-fraude employé */}
        {!isAdmin && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <Shield className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">Rappel important</p>
              <p>Toute dépense déclarée est <strong>vérifiée et validée par l'administration</strong>. Les déclarations inexactes sont traçables et sanctionnables. Une fois soumise, une dépense ne peut plus être modifiée.</p>
            </div>
          </div>
        )}

        {/* Statistiques */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Total validé',
              value: fmtMontant(getTotal('valide')),
              icon: <CheckCircle className="w-5 h-5 text-green-600" />,
              bg: 'bg-green-50 border-green-200',
              text: 'text-green-700',
            },
            {
              label: 'En attente',
              value: `${getNb('en_attente')} dépense${getNb('en_attente') > 1 ? 's' : ''}`,
              sub: getNb('en_attente') > 0 ? fmtMontant(getTotal('en_attente')) : '',
              icon: <Clock className="w-5 h-5 text-amber-600" />,
              bg: 'bg-amber-50 border-amber-200',
              text: 'text-amber-700',
            },
            {
              label: 'Rejetées',
              value: `${getNb('rejete')} dépense${getNb('rejete') > 1 ? 's' : ''}`,
              icon: <XCircle className="w-5 h-5 text-red-600" />,
              bg: 'bg-red-50 border-red-200',
              text: 'text-red-700',
            },
            {
              label: 'Total période',
              value: fmtMontant(depenses.filter(d => d.statut !== 'annule').reduce((s, d) => s + Number(d.montant), 0)),
              icon: <TrendingDown className="w-5 h-5 text-gray-600" />,
              bg: 'bg-gray-50 border-gray-200',
              text: 'text-gray-700',
            },
          ].map((s) => (
            <Card key={s.label} className={`border ${s.bg}`}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</span>
                  {s.icon}
                </div>
                <p className={`text-lg font-bold ${s.text}`}>{s.value}</p>
                {s.sub && <p className="text-xs text-gray-500">{s.sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filtres */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filtres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Date début */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">Du</Label>
                <Input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} className="h-8 text-sm" />
              </div>
              {/* Date fin */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">Au</Label>
                <Input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} className="h-8 text-sm" />
              </div>
              {/* Statut */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">Statut</Label>
                <Select value={filtreStatut} onValueChange={setFiltreStatut}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tous">Tous les statuts</SelectItem>
                    <SelectItem value="en_attente">En attente</SelectItem>
                    <SelectItem value="valide">Validées</SelectItem>
                    <SelectItem value="rejete">Rejetées</SelectItem>
                    <SelectItem value="annule">Annulées</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Catégorie */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">Catégorie</Label>
                <Select value={filtreCategorie} onValueChange={setFiltreCategorie}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tous">Toutes</SelectItem>
                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Employé */}
              {isAdmin && (
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Employé</Label>
                  <Input
                    placeholder="Nom ou email…"
                    value={filtreEmploye}
                    onChange={e => setFiltreEmploye(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              )}
            </div>

            {/* Raccourcis dates */}
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                { label: "Aujourd'hui", fn: () => { const d = today(); setDateDebut(d); setDateFin(d); } },
                { label: '7 derniers jours', fn: () => { const d = today(); const d7 = new Date(); d7.setDate(d7.getDate() - 6); setDateDebut(d7.toISOString().slice(0, 10)); setDateFin(d); } },
                { label: 'Ce mois', fn: () => { const n = new Date(); setDateDebut(new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10)); setDateFin(today()); } },
              ].map(({ label, fn }) => (
                <button key={label} onClick={fn} className="text-xs text-blue-600 hover:text-blue-800 underline-offset-2 hover:underline">
                  {label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {depenses.length} dépense{depenses.length > 1 ? 's' : ''}
              </CardTitle>
              {depenses.filter(d => d.statut === 'en_attente').length > 0 && isAdmin && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                  <AlertTriangle className="w-3 h-3" />
                  {depenses.filter(d => d.statut === 'en_attente').length} en attente de validation
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : depenses.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <TrendingDown className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucune dépense sur cette période</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-xs font-semibold text-gray-600 w-32">Date & heure</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-600">Employé</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-600">Description</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-600">Catégorie</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-600 text-right">Montant</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-600 w-28">Statut</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-600 text-right w-36">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {depenses.map((d) => (
                      <TableRow
                        key={d.id}
                        className={`hover:bg-gray-50 ${d.statut === 'en_attente' && isAdmin ? 'bg-amber-50/40' : ''} ${d.statut === 'annule' ? 'opacity-50' : ''}`}
                      >
                        <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {fmtDate(d.created_at)}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <User className="w-3 h-3 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-800">{d.employe_name || '—'}</p>
                              <p className="text-[10px] text-gray-400">{d.employe_email || ''}</p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="max-w-[200px]">
                          <p className="text-sm font-medium text-gray-800 truncate">{d.description}</p>
                          {d.justification && (
                            <p className="text-[10px] text-gray-400 truncate" title={d.justification}>
                              <FileText className="w-2.5 h-2.5 inline mr-0.5" />{d.justification}
                            </p>
                          )}
                        </TableCell>

                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                            <Tag className="w-2.5 h-2.5" />{d.categorie}
                          </span>
                        </TableCell>

                        <TableCell className="text-right">
                          <span className="text-sm font-bold text-gray-900">{fmtMontant(d.montant)}</span>
                        </TableCell>

                        <TableCell>
                          <StatutBadge statut={d.statut} />
                          {d.commentaire_admin && (
                            <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[120px]" title={d.commentaire_admin}>
                              {d.commentaire_admin}
                            </p>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Voir détail */}
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7" title="Voir détail"
                              onClick={() => setOpenDetail(d)}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>

                            {/* Actions admin uniquement, sur dépenses en attente */}
                            {isAdmin && d.statut === 'en_attente' && (
                              <>
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-7 w-7 text-green-600 hover:bg-green-50 hover:text-green-700"
                                  title="Valider"
                                  onClick={() => handleValider(d)}
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-7 w-7 text-red-600 hover:bg-red-50 hover:text-red-700"
                                  title="Rejeter"
                                  onClick={() => { setOpenRejeter(d); setCommentaire(''); }}
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}

                            {/* Annuler (admin, toute dépense sauf déjà annulée) */}
                            {isAdmin && d.statut !== 'annule' && (
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                title="Annuler (ne supprime pas)"
                                onClick={() => { setOpenAnnuler(d); setCommentaire(''); }}
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ── Dialog : Ajouter une dépense ──────────────────────────────────── */}
      <Dialog open={openAjouter} onOpenChange={setOpenAjouter}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-red-600" /> Déclarer une dépense
            </DialogTitle>
            <DialogDescription>
              Une fois soumise, votre déclaration sera vérifiée par l'administration.
              <strong className="text-amber-700"> Elle ne pourra plus être modifiée.</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="desc" className="text-sm font-medium">Description <span className="text-red-500">*</span></Label>
              <Input
                id="desc"
                placeholder="Ex: Achat de rame de papier A4"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="mt-1"
                maxLength={200}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Montant (FCFA) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Ex: 5000"
                  value={form.montant}
                  onChange={e => setForm({ ...form, montant: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Catégorie <span className="text-red-500">*</span></Label>
                <Select value={form.categorie} onValueChange={v => setForm({ ...form, categorie: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choisir…" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="just" className="text-sm font-medium">
                Justification / Motif
                <span className="text-gray-400 font-normal ml-1">(recommandé)</span>
              </Label>
              <Textarea
                id="just"
                placeholder="Détaillez la raison de cette dépense, la quantité achetée, le fournisseur…"
                rows={3}
                value={form.justification}
                onChange={e => setForm({ ...form, justification: e.target.value })}
                className="mt-1 resize-none"
                maxLength={500}
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Plus votre justification est précise, plus vite la dépense sera validée.
              </p>
            </div>

            {/* Avertissement immuabilité */}
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-md p-3 text-xs text-red-700">
              <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>En soumettant, vous confirmez que cette dépense est <strong>réelle et exacte</strong>. Toute déclaration frauduleuse est passible de sanctions.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAjouter(false)} disabled={saving}>Annuler</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
              {saving ? 'Envoi…' : 'Soumettre la dépense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog : Détail dépense ───────────────────────────────────────── */}
      <Dialog open={!!openDetail} onOpenChange={() => setOpenDetail(null)}>
        <DialogContent className="sm:max-w-md">
          {openDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Détail de la dépense
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Statut</span>
                  <StatutBadge statut={openDetail.statut} />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Employé</span>
                  <span className="font-medium">{openDetail.employe_name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Email</span>
                  <span className="text-xs text-gray-600">{openDetail.employe_email || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date / heure</span>
                  <span className="font-medium">{fmtDate(openDetail.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Catégorie</span>
                  <span>{openDetail.categorie}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Montant</span>
                  <span className="text-lg font-bold text-gray-900">{fmtMontant(openDetail.montant)}</span>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Description</p>
                  <p className="bg-gray-50 rounded p-2 text-gray-800">{openDetail.description}</p>
                </div>
                {openDetail.justification && (
                  <div>
                    <p className="text-gray-500 mb-1">Justification</p>
                    <p className="bg-gray-50 rounded p-2 text-gray-600 text-xs">{openDetail.justification}</p>
                  </div>
                )}
                {openDetail.validated_at && (
                  <>
                    <hr />
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Traité par</span>
                      <span>{openDetail.validateur_name || '—'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Le</span>
                      <span>{fmtDate(openDetail.validated_at)}</span>
                    </div>
                    {openDetail.commentaire_admin && (
                      <div>
                        <p className="text-gray-500 text-xs mb-1">Commentaire admin</p>
                        <p className="bg-red-50 border border-red-100 rounded p-2 text-red-700 text-xs">{openDetail.commentaire_admin}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenDetail(null)}>Fermer</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog : Rejeter ──────────────────────────────────────────────── */}
      <AlertDialog open={!!openRejeter} onOpenChange={() => { setOpenRejeter(null); setCommentaire(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <XCircle className="w-5 h-5" /> Rejeter la dépense
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">{openRejeter?.description}</span> — {fmtMontant(openRejeter?.montant || 0)}
              <br />Vous devez obligatoirement expliquer le motif du rejet à l'employé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 py-2">
            <Label className="text-sm font-medium">Motif du rejet <span className="text-red-500">*</span></Label>
            <Textarea
              className="mt-1 resize-none"
              rows={3}
              placeholder="Ex: Dépense déjà couverte par la caisse, montant non justifié…"
              value={commentaire}
              onChange={e => setCommentaire(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleRejeter} className="bg-red-600 hover:bg-red-700">
              Confirmer le rejet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialog : Annuler ──────────────────────────────────────────────── */}
      <AlertDialog open={!!openAnnuler} onOpenChange={() => { setOpenAnnuler(null); setCommentaire(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5" /> Annuler la dépense
            </AlertDialogTitle>
            <AlertDialogDescription>
              La dépense sera marquée comme <strong>annulée</strong> et ne sera plus comptabilisée.
              Elle reste consultable dans l'historique (pas de suppression définitive).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 py-2">
            <Label className="text-sm font-medium">Raison (optionnel)</Label>
            <Textarea
              className="mt-1 resize-none"
              rows={2}
              placeholder="Raison de l'annulation…"
              value={commentaire}
              onChange={e => setCommentaire(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction onClick={handleAnnuler}>
              Confirmer l'annulation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
};

export default DepensesPage;
