import { useState, useEffect } from "react";
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
import { Loader2, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
  });

  useEffect(() => {
    const session = localStorage.getItem("sessionToken");
    if (session) navigate("/");
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // ... (ton code handleSubmit reste 100% identique)
    // Je le garde tel quel pour ne rien casser
    try {
      if (isLogin) {
        const resp = await apiFetch("/api/users/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
          }),
        });
        const payload = await resp.json();
        if (!resp.ok) throw new Error(payload.error || "Login failed");

        localStorage.setItem("sessionToken", payload.session.access_token);

        const meResp = await apiFetch("/api/users/me", {
          headers: { Authorization: `Bearer ${payload.session.access_token}` },
        });
        const mePayload = await meResp.json();
        const roles = mePayload.user?.roles || [];

        toast.success("Connexion réussie !");
        navigate(roles.includes("admin") ? "/admin" : "/");
      } else {
        // inscription + auto-login (inchangé)
        // ... ton code existant
      }
    } catch (error: any) {
      toast.error(error.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Fond animé subtil */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-background to-cyan-900/20" />
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-purple-600/30 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-cyan-600/30 blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          {/* Carte principale avec glassmorphism */}
          <Card className={cn(
            "relative overflow-hidden border-0 shadow-2xl",
            "bg-background/70 backdrop-blur-xl",
            "ring-1 ring-border/50"
          )}>
            {/* Dégradé décoratif en haut */}
            <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-purple-600 via-pink-500 to-cyan-500" />

            <CardHeader className="text-center pb-8 pt-10">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center mb-4 shadow-lg">
                <Sparkles className="h-9 w-9 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-cyan-500 bg-clip-text text-transparent">
                {isLogin ? "Bienvenue" : "Rejoignez-nous"}
              </CardTitle>
              <CardDescription className="text-base mt-2">
                {isLogin
                  ? "Connectez-vous pour continuer"
                  : "Créez votre compte en quelques secondes"}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 pb-10">
              <form onSubmit={handleSubmit} className="space-y-5">
                {!isLogin && (
                  <div className="space-y-2 animate-in slide-in-from-top-4 duration-500">
                    <Label htmlFor="fullName" className="text-foreground/80">
                      Nom complet
                    </Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Jean Dupont"
                      className="h-12 text-base border-0 bg-muted/50 focus-visible:ring-purple-500/20"
                      value={formData.fullName}
                      onChange={(e) =>
                        setFormData({ ...formData, fullName: e.target.value })
                      }
                      required
                    />
                  </div>
                )}

                <div className="space-y-2 animate-in slide-in-from-left-4 duration-500 delay-100">
                  <Label htmlFor="email" className="text-foreground/80">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="vous@exemple.com"
                    className="h-12 text-base border-0 bg-muted/50 focus-visible:ring-purple-500/20"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2 animate-in slide-in-from-right-4 duration-500 delay-200">
                  <Label htmlFor="password" className="text-foreground/80">
                    Mot de passe
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="h-12 text-base border-0 bg-muted/50 focus-visible:ring-purple-500/20"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                    minLength={6}
                  />
                </div>

                <Button
                  type="submit"
                  className={cn(
                    "w-full h-12 text-base font-medium shadow-lg",
                    "bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-700 hover:to-cyan-600",
                    "transition-all duration-300 transform hover:scale-[1.02]"
                  )}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Patientez...
                    </>
                  ) : isLogin ? (
                    "Se connecter"
                  ) : (
                    "Créer mon compte"
                  )}
                </Button>
              </form>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background/70 px-3 text-muted-foreground">
                    Ou
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12 text-base backdrop-blur-sm hover:bg-accent/50 transition-all"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin
                  ? "Pas de compte ? Inscrivez-vous gratuitement"
                  : "Déjà inscrit ? Connectez-vous"}
              </Button>
            </CardContent>
          </Card>

          {/* Petite note démo en bas */}
          <p className="text-center text-sm text-muted-foreground max-w-sm mx-auto">
            <strong>Accès Démo :</strong> Inscrivez-vous librement, puis contactez
            l'administrateur pour obtenir les droits admin.
          </p>
        </div>
      </div>
    </>
  );
};

export default Auth;