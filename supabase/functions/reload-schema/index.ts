// Herlaadt de PostgREST schema cache zodat nieuwe functies (zoals reseed_logistics_data) zichtbaar worden.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "npm:postgres@3.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      return new Response(
        JSON.stringify({ ok: false, error: "SUPABASE_DB_URL not set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const sql = postgres(dbUrl, { prepare: false, max: 1 });
    try {
      await sql.unsafe("NOTIFY pgrst, 'reload schema'");
    } finally {
      await sql.end();
    }
    return new Response(
      JSON.stringify({ ok: true, message: "Schema cache reload triggered" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Reload failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
