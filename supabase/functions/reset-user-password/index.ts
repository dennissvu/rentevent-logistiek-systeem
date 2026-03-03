// Reset een gebruikerswachtwoord via de Supabase Admin API.
// Vereist: SUPABASE_SERVICE_ROLE_KEY in project secrets.
// Body: { "email": "user@example.com", "new_password": "NieuwWachtwoord123!" }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({
          error:
            "SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY moeten gezet zijn in project secrets.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: { email?: string; new_password?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: "Ongeldige JSON. Stuur { \"email\": \"...\", \"new_password\": \"...\" }",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = typeof body.email === "string" ? body.email.trim() : "";
    const newPassword = typeof body.new_password === "string" ? body.new_password : "";

    if (!email || !newPassword) {
      return new Response(
        JSON.stringify({
          error: "email en new_password zijn verplicht.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({
          error: "Wachtwoord moet minimaal 6 tekens zijn.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    // Gebruiker zoeken op e-mail (listUsers en filteren)
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      return new Response(
        JSON.stringify({ error: "Gebruikers ophalen mislukt: " + listError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = listData.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Geen gebruiker gevonden met dit e-mailadres." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Wachtwoord bijwerken mislukt: " + updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Wachtwoord voor ${email} is gereset.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("reset-user-password error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Reset mislukt",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
