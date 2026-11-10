// Éléments communs aux pages publiques des funnels promo (en-tête, compte à rebours, étapes)
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import logo from '../../../assets/logo_realtech.png';
import { whatsappLink } from '@/lib/funnels';

// Temps restant jusqu'à `target` (mis à jour chaque seconde)
export function useCountdown(target: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!target) return null;
  const ms = Math.max(0, new Date(target).getTime() - now);
  const s = Math.floor(ms / 1000);
  return { ms, days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatCountdown(c: NonNullable<ReturnType<typeof useCountdown>>, withSeconds = false) {
  const head = c.days > 0 ? `${pad(c.days)}j ${pad(c.hours)}h ${pad(c.minutes)}m` : `${pad(c.hours)}h ${pad(c.minutes)}m`;
  return withSeconds ? `${head} ${pad(c.seconds)}s` : head;
}

export function formatMinutes(c: NonNullable<ReturnType<typeof useCountdown>>) {
  return `${pad(c.hours * 60 + c.minutes)}:${pad(c.seconds)}`;
}

export function OfferBanner({ title, endsAt }: { title: string; endsAt: string | null }) {
  const c = useCountdown(endsAt);
  if (!c || c.ms <= 0) return null;
  return (
    <div className="bg-[#0D5FD9] text-white text-sm">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between sm:justify-center gap-3">
        <span className="font-medium truncate"><span className="hidden sm:inline">Promo {title} : </span>fin de l'offre dans</span>
        <span className="font-mono font-semibold bg-white/15 rounded px-2 py-0.5 tabular-nums shrink-0">{formatCountdown(c, true)}</span>
      </div>
    </div>
  );
}

export function PromoHeader({ whatsapp, right }: { whatsapp?: string | null; right?: React.ReactNode }) {
  const wa = whatsappLink(whatsapp);
  return (
    <header className="bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <Link to="/" aria-label="RealTech — accueil"><img src={logo} alt="RealTech Holding" className="h-9 w-auto" /></Link>
        {right ?? (wa && (
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-gray-600">{whatsapp}</span>
            <a href={wa} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-white text-sm font-semibold px-3 py-2">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </div>
        ))}
      </div>
    </header>
  );
}

const STEPS = ['Formule', 'Coordonnées', 'Paiement', 'Confirmation'];

// Fil d'étapes (desktop) : 0 = formule … 3 = confirmation
export function StepTrail({ current }: { current: number }) {
  return (
    <ol className="hidden md:flex items-center gap-5 text-sm">
      {STEPS.map((label, i) => (
        <li key={label} className={i < current ? 'text-emerald-600' : i === current ? 'text-[#0D5FD9] font-semibold' : 'text-gray-400'}>
          {i < current ? '✓ ' : `${i + 1}. `}{label}
        </li>
      ))}
    </ol>
  );
}

// Barre de progression (mobile) : étape `current` sur `total`
export function StepBar({ current, total, onBack }: { current: number; total: number; onBack?: () => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-gray-500">
        {onBack ? <button type="button" onClick={onBack} className="hover:text-gray-900">← Retour</button> : <span />}
        <span>{current} / {total}</span>
      </div>
      <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-[#0D5FD9] transition-all" style={{ width: `${(current / total) * 100}%` }} />
      </div>
    </div>
  );
}

export const primaryBtn =
  'w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold h-12 px-5 transition-colors';
