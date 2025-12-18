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
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Shield, Zap } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const resp = await apiFetch("/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Identifiants incorrects");

      const token = data.session?.access_token;
      if (!token) throw new Error("Token manquant");

      localStorage.setItem("sessionToken", token);

      const meResp = await apiFetch("/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!meResp.ok) throw new Error("Impossible de vérifier les droits");

      const meData = await meResp.json();
      const roles = meData.user?.roles || [];

      if (roles.includes("admin")) {
        toast.success("Accès administrateur autorisé ⚡");
        navigate("/admin");
      } else {
        localStorage.removeItem("sessionToken");
        toast.error("Accès refusé : droits administrateur requis");
        navigate("/");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Fond fixe corrigé — clics 100% fonctionnels */}
      <div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-black to-orange-900/40" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-600/20 rounded-full blur-3xl animate-pulse delay-700" />
      </div>

      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card
            className={cn(
              "relative overflow-hidden border-0 shadow-2xl",
              "bg-black/60 backdrop-blur-2xl",
              "ring-1 ring-purple-500/30"
            )}
          >
            {/* Barre lumineuse supérieure */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500" />

            <CardHeader className="text-center space-y-6 pt-12 pb-8">
              <div className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-600 to-orange-500 p-1 shadow-2xl">
                <div className="w-full h-full rounded-3xl bg-black flex items-center justify-center">
                  <Shield className="h-12 w-12 text-white" strokeWidth={2} />
                </div>
              </div>

              <div>
                <CardTitle className="text-4xl font-bold text-white flex items-center justify-center gap-3">
                  Admin <Zap className="h-8 w-8 text-orange-400" />
                </CardTitle>
                <CardDescription className="text-gray-400 text-lg mt-3">
                  Accès réservé aux administrateurs
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="pt-6 pb-12 px-8">
              <form onSubmit={handleSubmit} className="space-y-7">
                <div className="space-y-2">
                  <Label htmlFor="admin-email" className="text-gray-300 text-base">
                    Email administrateur
                  </Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-14 bg-white/5 border-white/10 text-white placeholder:text-gray-500 text-base focus-visible:ring-purple-500 focus-visible:ring-offset-0"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-password" className="text-gray-300 text-base">
                    Mot de passe
                  </Label>
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-14 bg-white/5 border-white/10 text-white placeholder:text-gray-500 text-base focus-visible:ring-purple-500 focus-visible:ring-offset-0"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className={cn(
                    "w-full h-14 text-lg font-semibold shadow-2xl",
                    "bg-gradient-to-r from-purple-600 to-orange-600 hover:from-purple-500 hover:to-orange-500",
                    "transition-all duration-300 transform hover:scale-[1.02] hover:shadow-purple-500/40"
                  )}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                      Vérification en cours...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-3 h-6 w-6" />
                      Accéder au panneau administrateur
                    </>
                  )}
                </Button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-10">
                Seuls les comptes avec le rôle{" "}
                <span className="text-orange-400 font-bold">admin</span> peuvent
                accéder à cette zone.
              </p>
            </CardContent>
          </Card>

          
        </div>
      </div>
    </>
  );
};

export default AdminLogin;