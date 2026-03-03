import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Truck } from "lucide-react";

const FAILED_ATTEMPTS_BEFORE_COOLDOWN = 3;
const COOLDOWN_SECONDS = 60;

function getUserFriendlyLoginError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials") || lower.includes("invalid_credentials")) {
    return "Ongeldig e-mailadres of wachtwoord.";
  }
  if (lower.includes("email not confirmed")) {
    return "Bevestig eerst je e-mailadres.";
  }
  if (lower.includes("too many requests") || lower.includes("rate")) {
    return "Te veel pogingen. Wacht even en probeer het opnieuw.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Geen verbinding. Controleer je internet en probeer opnieuw.";
  }
  return "Inloggen mislukt. Controleer je gegevens en probeer het opnieuw.";
}

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const failedAttemptsRef = useRef(0);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || isLoading || cooldownRemaining > 0) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        failedAttemptsRef.current += 1;
        if (failedAttemptsRef.current >= FAILED_ATTEMPTS_BEFORE_COOLDOWN) {
          failedAttemptsRef.current = 0;
          setCooldownRemaining(COOLDOWN_SECONDS);
          const interval = setInterval(() => {
            setCooldownRemaining((prev) => {
              if (prev <= 1) {
                clearInterval(interval);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
        toast({
          title: "Fout bij inloggen",
          description: getUserFriendlyLoginError(error.message),
          variant: "destructive",
        });
        return;
      }
      failedAttemptsRef.current = 0;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Truck className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Rent & Event Logistiek</CardTitle>
          <CardDescription>
            Log in met je e-mailadres en wachtwoord
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="jouw@email.nl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading || cooldownRemaining > 0}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Wachtwoord"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading || cooldownRemaining > 0}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || cooldownRemaining > 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Bezig met inloggen...
                </>
              ) : cooldownRemaining > 0 ? (
                `Wacht ${cooldownRemaining}s en probeer opnieuw`
              ) : (
                "Inloggen"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
