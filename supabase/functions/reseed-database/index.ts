// Reseed database: runs the logistics seed (transport, drivers, orders, etc.).
// Users/auth are NOT touched – the seed contains no user data.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "npm:postgres@3.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      return new Response(
        JSON.stringify({
          error:
            "SUPABASE_DB_URL is not set. Configure the database connection string in the project secrets.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sql = postgres(dbUrl, { prepare: false, max: 1 });

    try {
      const seedPath = new URL("./seed.sql", import.meta.url);
      const seedSql = await Deno.readTextFile(seedPath);

      // Split on semicolon followed by newline; skip comments and empty lines
      const statements = seedSql
        .split(/;\s*\n/)
        .map((s) => s.trim())
        .filter(
          (s) =>
            s.length > 0 &&
            !s.startsWith("--") &&
            (s.startsWith("DELETE") ||
              s.startsWith("INSERT") ||
              s.startsWith("UPDATE"))
        );

      for (const stmt of statements) {
        if (stmt) await sql.unsafe(stmt + ";");
      }

      return new Response(
        JSON.stringify({
          success: true,
          message:
            "Database gereseeded. Alleen logistieke data; gebruikers zijn niet gewijzigd.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } finally {
      await sql.end();
    }
  } catch (e) {
    console.error("reseed-database error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Reseed mislukt",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
