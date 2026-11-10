// Admin · réglages de paiement des funnels (/admin/funnels/paiement)
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminFunnelApi, METHOD_DOTS, type PaymentSettings } from '@/lib/funnels';

const DURATIONS = [15, 30, 45, 60, 120, 240, 1440];
const durationLabel = (m: number) => (m < 60 ? `${m} minutes` : m === 1440 ? '24 heures' : `${m / 60} heure${m > 60 ? 's' : ''}`);

export default function FunnelPayments() {
  const [s, setS] = useState<PaymentSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { adminFunnelApi.settings().then(setS).catch((e) => toast.error(e.message)); }, []);
  if (!s) return <div className="py-24 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const save = async () => {
    setSaving(true);
    try {
      setS(await adminFunnelApi.saveSettings(s));
      toast.success('Réglages enregistrés');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const transfer = (key: 'wave' | 'orange_money', label: string) => (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${METHOD_DOTS[key]}`} />{label}</p>
          <Switch checked={s[key].enabled} onCheckedChange={(c) => setS({ ...s, [key]: { ...s[key], enabled: c } })} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Numéro</Label>
            <Input value={s[key].number} placeholder="77 000 00 00" onChange={(e) => setS({ ...s, [key]: { ...s[key], number: e.target.value } })} />
          </div>
          <div className="space-y-1.5">
            <Label>Nom du titulaire affiché</Label>
            <Input value={s[key].holder} onChange={(e) => setS({ ...s, [key]: { ...s[key], holder: e.target.value } })} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to="/admin/funnels" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Funnels promo</Link>
        <h1 className="text-2xl font-bold">Réglages paiement</h1>
        <p className="text-sm text-muted-foreground">Numéros affichés par défaut dans tous les funnels. Un moyen sans numéro n'est pas proposé.</p>
      </div>

      {transfer('wave', 'Wave')}
      {transfer('orange_money', 'Orange Money')}

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${METHOD_DOTS.cod}`} />Paiement à la livraison</p>
            <Switch checked={s.cod.enabled} onCheckedChange={(c) => setS({ ...s, cod: { ...s.cod, enabled: c } })} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Zones acceptées</Label>
              <Input value={s.cod.zones} placeholder="Dakar, Pikine, Rufisque" onChange={(e) => setS({ ...s, cod: { ...s.cod, zones: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label>Plafond (F CFA, 0 = sans plafond)</Label>
              <Input type="number" min={0} value={s.cod.max_amount} onChange={(e) => setS({ ...s, cod: { ...s.cod, max_amount: Number(e.target.value) } })} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Au-delà du plafond, ce moyen n'est pas proposé au client.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 grid sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Réservation (Wave / OM)</Label>
            <Select value={String(s.reservation_minutes)} onValueChange={(v) => setS({ ...s, reservation_minutes: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[...new Set([...DURATIONS, s.reservation_minutes])].sort((a, b) => a - b).map((m) => <SelectItem key={m} value={String(m)}>{durationLabel(m)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Email d'alerte équipe</Label>
            <Input type="email" value={s.team_email} placeholder="equipe@realtechprint.com" onChange={(e) => setS({ ...s, team_email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp affiché aux clients</Label>
            <Input value={s.team_whatsapp} placeholder="+221 77 422 03 20" onChange={(e) => setS({ ...s, team_whatsapp: e.target.value })} />
          </div>
          <p className="sm:col-span-3 text-xs text-muted-foreground">
            Sans paiement déclaré dans ce délai, la réservation expire : le stock promo est libéré et le client reçoit un mail (s'il a donné son email).
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Enregistrer</Button>
      </div>
    </div>
  );
}
