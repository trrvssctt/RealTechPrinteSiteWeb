import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Shield, Lock, Eye, EyeOff, Smartphone, Mail } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import logo_realtech from '../../../assets/logo_realtech.png';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    
    setLoading(true);

    try {
      const resp = await apiFetch("/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Identifiants incorrects");

      // support multiple token shapes returned by backend
      const token = data.session?.access_token || data.token || data.access_token;
      if (!token) throw new Error("Token manquant");

      localStorage.setItem("sessionToken", token);
      
      if (rememberMe) {
        localStorage.setItem("rememberAdminEmail", email);
      } else {
        localStorage.removeItem("rememberAdminEmail");
      }

      const meResp = await apiFetch("/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!meResp.ok) throw new Error("Impossible de vérifier les droits");

      const meData = await meResp.json();
      const roles = meData.user?.roles || [];

      if (roles.includes("admin")) {
        toast.success("✅ Connexion réussie", {
          description: "Accès au tableau de bord autorisé"
        });
        setTimeout(() => navigate("/admin"), 800);
      } else {
        localStorage.removeItem("sessionToken");
        toast.error("❌ Accès refusé", {
          description: "Droits administrateur requis"
        });
        navigate("/");
      }
    } catch (err: any) {
      console.error('Login error:', err);
      toast.error("❌ Échec de connexion", {
        description: err.message || "Vérifiez vos identifiants"
      });
    } finally {
      setLoading(false);
    }
  };

  // Load remembered email on component mount
  useState(() => {
    const rememberedEmail = localStorage.getItem("rememberAdminEmail");
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-gray-50 via-white to-blue-50">
      {/* Header with Logo */}
      <div className="absolute top-6 left-6 md:top-8 md:left-8 flex items-center gap-3">
        <div className="w-22 h-15-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-sm">
          <img 
            src={logo_realtech} 
            alt="RealTech Holding" 
            className="w-25 h-17 "
          />
        </div>
        <div className="hidden md:block">
          <h2 className="text-xl font-bold text-gray-900">RealTech Holding</h2>
          <p className="text-xs text-gray-500">Panel d'administration</p>
        </div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md">
        <Card className="border shadow-xl overflow-hidden">
          {/* Card Header */}
          <CardHeader className="text-center pb-6 pt-8 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="mx-auto mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Lock className="h-8 w-8 text-white" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                Connexion Admin
              </CardTitle>
              <CardDescription className="text-gray-600 mt-2">
                Accès sécurisé au tableau de bord RealTech
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Input */}
              <div className="space-y-2">
                <Label htmlFor="admin-email" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email administrateur
                </Label>
                <div className="relative">
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@realtech.sn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 pl-10 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    required
                    disabled={loading}
                  />
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <Label htmlFor="admin-password" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pl-10 pr-10 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    required
                    disabled={loading}
                  />
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="remember-me"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    disabled={loading}
                  />
                  <Label htmlFor="remember-me" className="text-sm text-gray-600">
                    Se souvenir de moi
                  </Label>
                </div>
                <button
                  type="button"
                  onClick={() => toast.info("Contactez le support pour réinitialiser votre mot de passe")}
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  disabled={loading}
                >
                  Mot de passe oublié ?
                </button>
              </div>

              {/* Login Button */}
              <Button
                type="submit"
                size="lg"
                className={cn(
                  "w-full h-12 text-base font-semibold mt-4",
                  "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700",
                  "text-white transition-all duration-300",
                  loading && "opacity-90 cursor-not-allowed"
                )}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                    Connexion en cours...
                  </>
                ) : (
                  <>
                    <Shield className="mr-3 h-5 w-5" />
                    Se connecter
                  </>
                )}
              </Button>
            </form>

            {/* Security Info */}
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                <Shield className="h-4 w-4 text-green-600" />
                <span>Connexion sécurisée par chiffrement SSL</span>
              </div>
            </div>
          </CardContent>

          {/* Card Footer */}
          <CardFooter className="bg-gray-50 py-4">
            <div className="text-center w-full">
              <p className="text-sm text-gray-600">
                Problème de connexion ?{" "}
                <button
                  onClick={() => toast.info("Contactez le support technique au +221 77 422 03 20")}
                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                >
                  Contacter le support
                </button>
              </p>
              <div className="flex items-center justify-center gap-2 mt-3">
                <Smartphone className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-500">+221 77 422 03 20</span>
              </div>
            </div>
          </CardFooter>
        </Card>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            ⚠️ Cet accès est strictement réservé au personnel autorisé de RealTech Holding.
            Toute tentative non autorisée sera journalisée.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 text-center">
        <p className="text-xs text-gray-500">
          © {new Date().getFullYear()} RealTech Holding • Tous droits réservés
        </p>
        <p className="text-xs text-gray-400 mt-1">
          v2.1.0 • Sécurité renforcée
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;