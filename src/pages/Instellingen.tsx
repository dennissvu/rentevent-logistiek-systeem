import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, Database, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Instellingen = () => {
  const [reseedLoading, setReseedLoading] = useState(false);
  const [reseedMessage, setReseedMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleReseed = async () => {
    if (!confirm("Weet je zeker dat je de database wilt reseeden? Alle logistieke testdata (orders, chauffeurs, transport, planning) wordt vervangen. Gebruikersaccounts blijven behouden.")) {
      return;
    }
    setReseedLoading(true);
    setReseedMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke("reseed-database", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setReseedMessage({
        type: "success",
        text: data?.message ?? "Database is succesvol gereseeded. Gebruikers zijn niet gewijzigd.",
      });
    } catch (e) {
      setReseedMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Reseed mislukt.",
      });
    } finally {
      setReseedLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-7 w-7" />
          Instellingen
        </h1>
        <p className="text-muted-foreground mt-1">
          Systeeminstellingen en beheer
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Admin – Database reseed
          </CardTitle>
          <CardDescription>
            Zet alle logistieke testdata terug naar de standaard seed. Orders, chauffeurs, transportmateriaal, combi&apos;s en planning worden opnieuw ingeladen. <strong>Gebruikersaccounts worden niet gewijzigd</strong> – de seeder bevat geen users.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reseedMessage && (
            <Alert variant={reseedMessage.type === "error" ? "destructive" : "default"}>
              {reseedMessage.type === "error" ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              <AlertDescription>{reseedMessage.text}</AlertDescription>
            </Alert>
          )}
          <Button
            variant="destructive"
            onClick={handleReseed}
            disabled={reseedLoading}
          >
            {reseedLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reseeden…
              </>
            ) : (
              "Database reseeden"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Instellingen;
