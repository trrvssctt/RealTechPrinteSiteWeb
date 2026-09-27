import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Trash2, Plus, Minus, ShoppingBag, ChevronRight,
  Shield, Phone, MessageCircle, CheckCircle2, User,
  Mail, AlertCircle, Package, Tag, ArrowLeft, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/contexts/CartContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

// ─── Sécurité : constantes de validation ─────────────────────────────────────

const MAX_NAME_LENGTH   = 80;
const MAX_PHONE_LENGTH  = 20;
const MAX_EMAIL_LENGTH  = 100;
const MAX_QTY_PER_ITEM  = 99;
const SUBMIT_COOLDOWN_MS = 8000; // 8 s entre deux soumissions
const PHONE_REGEX = /^[+\d][\d\s\-().]{6,18}$/;
const EMAIL_REGEX = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,128}\.[a-zA-Z]{2,10}$/;

/** Supprime tout HTML/JS potentiel et coupe à la longueur max. */
function sanitize(value: string, maxLen: number): string {
  return value
    .replace(/<[^>]*>/g, '')          // strip balises HTML
    .replace(/[<>"'`\\]/g, '')        // supprimer chars dangereux
    .replace(/javascript:/gi, '')     // neutraliser proto JS
    .replace(/on\w+\s*=/gi, '')       // supprimer event handlers
    .trim()
    .slice(0, maxLen);
}

function validatePhone(v: string): string | null {
  if (!v.trim()) return 'Le numéro de téléphone est requis';
  if (!PHONE_REGEX.test(v.trim())) return 'Numéro invalide (ex: +221 77 422 0320)';
  return null;
}

function validateEmail(v: string): string | null {
  if (!v.trim()) return null; // optionnel
  if (!EMAIL_REGEX.test(v.trim())) return 'Adresse email invalide';
  return null;
}

// ─── Étapes de la commande ────────────────────────────────────────────────────

type Step = 'cart' | 'checkout' | 'success';

const STEPS = [
  { key: 'cart',     label: 'Panier',     num: 1 },
  { key: 'checkout', label: 'Infos',      num: 2 },
  { key: 'success',  label: 'Confirmation', num: 3 },
];

// ─── Composant principal ──────────────────────────────────────────────────────

const Cart = () => {
  const { cart, removeFromCart, updateQuantity, totalPrice, clearCart } = useCart();

  const [step, setStep] = useState<Step>('cart');
  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Honeypot anti-bot (ne doit jamais être rempli par un humain)
  const honeypotRef = useRef<HTMLInputElement>(null);

  // Protection contre la double soumission
  const lastSubmitRef = useRef<number>(0);

  // ─── WhatsApp ────────────────────────────────────────────────────────────

  const generateWhatsAppMessage = () => {
    const lines = cart
      .map(i => `• ${i.name.slice(0, 50)} ×${i.quantity} — ${(i.price * i.quantity).toLocaleString('fr-FR')} FCFA`)
      .join('\n');
    const msg = `Bonjour RealTech Print,\nJe souhaite commander :\n\n${lines}\n\n💰 Total : ${totalPrice.toLocaleString('fr-FR')} FCFA\n\nMerci de confirmer ma commande.`;
    return encodeURIComponent(msg);
  };

  // ─── Validation formulaire ────────────────────────────────────────────────

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const cleanName = sanitize(name, MAX_NAME_LENGTH);
    if (!cleanName) errs.name = 'Votre nom est requis';
    const phoneErr = validatePhone(sanitize(phone, MAX_PHONE_LENGTH));
    if (phoneErr) errs.phone = phoneErr;
    const emailErr = validateEmail(sanitize(email, MAX_EMAIL_LENGTH));
    if (emailErr) errs.email = emailErr;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ─── Soumission ───────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    // Honeypot : si rempli → bot détecté → ignorer silencieusement
    if (honeypotRef.current?.value) {
      toast.success('Commande envoyée !'); // faux succès pour le bot
      return;
    }

    // Cooldown anti-spam
    const now = Date.now();
    if (now - lastSubmitRef.current < SUBMIT_COOLDOWN_MS) {
      toast.error('Veuillez patienter quelques secondes avant de réessayer');
      return;
    }

    if (!validate()) return;

    lastSubmitRef.current = now;
    setSubmitting(true);

    try {
      const payload = {
        customer_name:  sanitize(name,  MAX_NAME_LENGTH),
        customer_phone: sanitize(phone, MAX_PHONE_LENGTH),
        customer_email: email ? sanitize(email, MAX_EMAIL_LENGTH) : null,
        items: cart.map(i => ({
          product_id:   i.id || null,
          product_name: i.name.slice(0, 120),
          unit_price:   Math.max(0, Number(i.price)),
          quantity:     Math.min(Math.max(1, Number(i.quantity)), MAX_QTY_PER_ITEM),
        })),
        total_amount: totalPrice,
      };

      const resp = await apiFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.error || `Erreur ${resp.status}`);
      }

      const body = await resp.json();
      const id: string = body?.data?.id || '';
      setOrderId(id);
      clearCart();
      setStep('success');
    } catch (err: any) {
      console.error('Order error:', err);
      toast.error(err.message || 'Impossible de créer la commande, veuillez réessayer');
    } finally {
      setSubmitting(false);
    }
  }, [name, phone, email, cart, totalPrice, clearCart]);

  // ─── Quantité avec garde-fou ──────────────────────────────────────────────

  const handleQty = (id: string, delta: number, current: number) => {
    const next = Math.max(1, Math.min(current + delta, MAX_QTY_PER_ITEM));
    updateQuantity(id, next);
  };

  // ─── Barre de progression ─────────────────────────────────────────────────

  const StepBar = () => (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const done    = STEPS.findIndex(x => x.key === step) > i;
        const current = s.key === step;
        return (
          <div key={s.key} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              done    ? 'bg-green-100 text-green-700' :
              current ? 'bg-primary text-white shadow-md' :
                        'bg-gray-100 text-gray-400'
            }`}>
              {done
                ? <CheckCircle2 className="w-4 h-4" />
                : <span className="w-4 h-4 flex items-center justify-center text-xs font-bold">{s.num}</span>
              }
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className="w-4 h-4 text-gray-300 mx-1" />
            )}
          </div>
        );
      })}
    </div>
  );

  // ─── État vide ────────────────────────────────────────────────────────────

  if (!cart || cart.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-28 h-28 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-14 h-14 text-gray-300" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Votre panier est vide</h1>
          <p className="text-gray-500 mb-8 text-sm">
            Explorez notre catalogue et ajoutez vos produits préférés.
          </p>
          <Button size="lg" className="w-full" asChild>
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Découvrir nos produits
            </Link>
          </Button>
          <a
            href="https://wa.me/221774220320"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-center gap-2 text-sm text-[#25D366] hover:underline"
          >
            <MessageCircle className="w-4 h-4" />
            Commander sur WhatsApp
          </a>
        </div>
      </div>
    );
  }

  // ─── Succès ───────────────────────────────────────────────────────────────

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6 animate-bounce">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Commande confirmée !</h1>
          {orderId && (
            <p className="text-xs text-gray-400 mb-1 font-mono">Réf. #{orderId.slice(0, 8).toUpperCase()}</p>
          )}
          <p className="text-gray-500 text-sm mb-8">
            Votre commande a été enregistrée. Notre équipe vous contactera très bientôt pour confirmer la livraison.
          </p>
          <div className="space-y-3">
            <a
              href={`https://wa.me/221774220320?text=${encodeURIComponent('Bonjour, j\'ai passé une commande (réf. ' + (orderId?.slice(0, 8).toUpperCase() || '') + '). Merci de confirmer.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-[#25D366] text-white font-medium hover:bg-[#20BD5A] transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              Suivre sur WhatsApp
            </a>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/"><ArrowLeft className="w-4 h-4 mr-2" />Retour à la boutique</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Rendu principal ──────────────────────────────────────────────────────

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-8 max-w-5xl">

        {/* En-tête */}
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center text-sm text-gray-400 hover:text-primary mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" /> Continuer mes achats
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {step === 'cart' ? 'Mon Panier' : 'Finaliser ma commande'}
          </h1>
        </div>

        <StepBar />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Colonne gauche ─────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">

            {/* ── ÉTAPE 1 : Liste produits ──────────────────────────── */}
            {step === 'cart' && cart.map((item, idx) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-4 items-start transition-all hover:shadow-md"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                {/* Image */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 bg-gray-50 border border-gray-100">
                  {item.image
                    ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                    : <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-gray-300" /></div>
                  }
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base leading-tight mb-1 truncate">
                    {item.name}
                  </h3>
                  {item.category && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400 mb-2">
                      <Tag className="w-3 h-3" />{item.category}
                    </span>
                  )}
                  <p className="text-base font-bold text-primary">
                    {(item.price * item.quantity).toLocaleString('fr-FR')} FCFA
                  </p>
                  <p className="text-xs text-gray-400">{item.price.toLocaleString('fr-FR')} FCFA / unité</p>
                </div>

                {/* Contrôles */}
                <div className="flex flex-col items-end gap-3 flex-shrink-0">
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1 bg-gray-50 rounded-xl border border-gray-200 p-1">
                    <button
                      onClick={() => handleQty(item.id, -1, item.quantity)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:bg-white hover:shadow-sm transition-all disabled:opacity-30"
                      disabled={item.quantity <= 1}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-gray-800">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleQty(item.id, +1, item.quantity)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:bg-white hover:shadow-sm transition-all disabled:opacity-30"
                      disabled={item.quantity >= MAX_QTY_PER_ITEM}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* ── ÉTAPE 2 : Formulaire informations ────────────────── */}
            {step === 'checkout' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" /> Vos informations
                </h2>

                {/* Honeypot invisible (anti-bot) */}
                <input
                  ref={honeypotRef}
                  type="text"
                  name="website"
                  autoComplete="off"
                  tabIndex={-1}
                  aria-hidden="true"
                  style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }}
                />

                <div className="space-y-5">
                  {/* Nom */}
                  <div>
                    <Label htmlFor="cust-name" className="text-sm font-medium text-gray-700 mb-1 block">
                      Nom complet <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                      <Input
                        id="cust-name"
                        className={`pl-9 ${errors.name ? 'border-red-400 focus-visible:ring-red-300' : ''}`}
                        placeholder="Votre nom et prénom"
                        value={name}
                        onChange={e => {
                          setName(e.target.value.slice(0, MAX_NAME_LENGTH));
                          if (errors.name) setErrors(p => ({ ...p, name: '' }));
                        }}
                        maxLength={MAX_NAME_LENGTH}
                        autoComplete="name"
                        aria-describedby={errors.name ? 'name-err' : undefined}
                      />
                    </div>
                    {errors.name && (
                      <p id="name-err" className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />{errors.name}
                      </p>
                    )}
                  </div>

                  {/* Téléphone */}
                  <div>
                    <Label htmlFor="cust-phone" className="text-sm font-medium text-gray-700 mb-1 block">
                      Téléphone <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                      <Input
                        id="cust-phone"
                        type="tel"
                        className={`pl-9 ${errors.phone ? 'border-red-400 focus-visible:ring-red-300' : ''}`}
                        placeholder="+221 77 422 0320"
                        value={phone}
                        onChange={e => {
                          setPhone(e.target.value.slice(0, MAX_PHONE_LENGTH));
                          if (errors.phone) setErrors(p => ({ ...p, phone: '' }));
                        }}
                        maxLength={MAX_PHONE_LENGTH}
                        autoComplete="tel"
                        inputMode="tel"
                        aria-describedby={errors.phone ? 'phone-err' : undefined}
                      />
                    </div>
                    {errors.phone && (
                      <p id="phone-err" className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />{errors.phone}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <Label htmlFor="cust-email" className="text-sm font-medium text-gray-700 mb-1 block">
                      Email <span className="text-gray-400 font-normal">(optionnel)</span>
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                      <Input
                        id="cust-email"
                        type="email"
                        className={`pl-9 ${errors.email ? 'border-red-400 focus-visible:ring-red-300' : ''}`}
                        placeholder="votre@email.com"
                        value={email}
                        onChange={e => {
                          setEmail(e.target.value.slice(0, MAX_EMAIL_LENGTH));
                          if (errors.email) setErrors(p => ({ ...p, email: '' }));
                        }}
                        maxLength={MAX_EMAIL_LENGTH}
                        autoComplete="email"
                        inputMode="email"
                        aria-describedby={errors.email ? 'email-err' : undefined}
                      />
                    </div>
                    {errors.email && (
                      <p id="email-err" className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />{errors.email}
                      </p>
                    )}
                  </div>
                </div>

                {/* Badge sécurité */}
                <div className="flex items-center gap-2 mt-5 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                  <Shield className="w-4 h-4 text-green-500 flex-shrink-0" />
                  Vos données sont protégées et ne seront jamais partagées avec des tiers.
                </div>

                {/* Récap commande dans le formulaire (mobile) */}
                <div className="mt-5 pt-5 border-t border-gray-100 lg:hidden">
                  <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Votre commande</p>
                  {cart.map(i => (
                    <div key={i.id} className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-600 truncate mr-2">{i.name} <span className="text-gray-400">×{i.quantity}</span></span>
                      <span className="font-medium whitespace-nowrap">{(i.price * i.quantity).toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Colonne droite : récapitulatif ─────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-24">
              <h2 className="text-base font-semibold text-gray-800 mb-4">Récapitulatif</h2>

              {/* Détail articles */}
              <div className="space-y-2 mb-4">
                {cart.map(i => (
                  <div key={i.id} className="flex justify-between text-sm">
                    <span className="text-gray-500 truncate mr-2 max-w-[160px]">
                      {i.name} <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">×{i.quantity}</Badge>
                    </span>
                    <span className="font-medium text-gray-800 whitespace-nowrap">
                      {(i.price * i.quantity).toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-3 mb-5">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{totalItems} article{totalItems > 1 ? 's' : ''}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-gray-800">Total</span>
                  <span className="text-xl font-bold text-primary">{totalPrice.toLocaleString('fr-FR')} FCFA</span>
                </div>
              </div>

              {/* Actions selon étape */}
              <div className="space-y-2">
                {step === 'cart' && (
                  <>
                    <Button
                      className="w-full font-semibold"
                      size="lg"
                      onClick={() => setStep('checkout')}
                    >
                      Passer la commande
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>

                    <a
                      href={`https://wa.me/221774220320?text=${generateWhatsAppMessage()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-[#25D366] text-white text-sm font-medium hover:bg-[#20BD5A] transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Valider via WhatsApp
                    </a>

                    <a
                      href="tel:+221774220320"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      Commander par téléphone
                    </a>

                    <button
                      onClick={clearCart}
                      className="w-full text-xs text-gray-400 hover:text-red-400 transition-colors py-1"
                    >
                      Vider le panier
                    </button>
                  </>
                )}

                {step === 'checkout' && (
                  <>
                    <Button
                      className="w-full font-semibold"
                      size="lg"
                      onClick={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Envoi en cours…</>
                        : <><CheckCircle2 className="w-4 h-4 mr-2" />Confirmer la commande</>
                      }
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full text-gray-500 text-sm"
                      onClick={() => { setStep('cart'); setErrors({}); }}
                      disabled={submitting}
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" />Retour au panier
                    </Button>
                  </>
                )}
              </div>

              {/* Badges de confiance */}
              <div className="mt-5 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { icon: Shield,         label: 'Paiement\nsécurisé' },
                    { icon: MessageCircle,  label: 'Support\nWhatsApp' },
                    { icon: CheckCircle2,   label: 'Livraison\nrapide' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-[10px] text-gray-400 leading-tight whitespace-pre-line">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
