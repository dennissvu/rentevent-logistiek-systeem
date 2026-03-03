import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, date } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch planning context from database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch orders for the date
    const { data: allOrders } = await supabase
      .from("orders")
      .select("*")
      .in("status", ["bevestigd", "optie"]);

    const orders = (allOrders || []).filter((o: any) => {
      const delivDate = o.delivery_date || o.start_date;
      const pickDate = o.pickup_date || o.end_date;
      return delivDate === date || pickDate === date;
    });

    // Fetch drivers
    const { data: drivers } = await supabase
      .from("drivers")
      .select("*")
      .eq("is_active", true);

    // Fetch transport materials and combis
    const { data: transport } = await supabase
      .from("transport_materials")
      .select("*")
      .eq("is_active", true);

    const { data: combis } = await supabase
      .from("transport_combis")
      .select("*")
      .eq("is_active", true);

    // Fetch existing assignments for the date's orders
    const orderIds = orders.map((o: any) => o.id);
    let assignments: any[] = [];
    if (orderIds.length > 0) {
      const { data: assignData } = await supabase
        .from("order_transport_assignments")
        .select("*")
        .in("order_id", orderIds);
      assignments = assignData || [];
    }

    // Fetch driver schedule exceptions for this date
    const { data: exceptions } = await supabase
      .from("driver_schedule_exceptions")
      .select("*")
      .eq("exception_date", date);

    // Fetch planning memory/tips
    const { data: memoryItems } = await supabase
      .from("planning_memory")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    // Build context summary
    const contextSummary = buildContextSummary(date, orders, drivers || [], transport || [], combis || [], assignments, exceptions || [], memoryItems || []);

    const systemPrompt = `Je bent een ervaren logistiek planningsassistent voor een fietsverhuur- en transportbedrijf. Je helpt medewerkers met het plannen van leveringen en ophalingen van fietsen (e-choppers, e-fatbikes, e-bikes, fietsen, tweepersoonsfietsen/tandemfietsen).

## STRIKTE REGELS — LEES DIT EERST

**Je mag UITSLUITEND de volgende acties uitvoeren:**
1. **Chauffeur toewijzen** aan een segment (leveren/ophalen) → \`assign_transport\` of \`assign_driver\`
2. **Transportmiddel toewijzen** aan een segment → \`assign_transport\`
3. **Notities toevoegen** aan een order → \`update_order\` met ALLEEN het veld \`notes\`

**Je mag ABSOLUUT NIET:**
- Voertuigaantallen of voertuigtypes wijzigen
- Leverdata of -tijden wijzigen
- Ophaaldata of -tijden wijzigen
- Locaties wijzigen
- Status wijzigen
- Ophaal- of leverritten verwijderen (\`remove_assignment\` is VERBODEN)
- Orders splitsen (\`split_delivery\` is VERBODEN)
- Enig ander orderveld wijzigen behalve \`notes\`

**Bij notities:** Bestaande notities MOETEN behouden blijven. Voeg nieuwe tekst toe aan het einde, gescheiden door " | ". Verwijder NOOIT bestaande notitietekst.

Als een medewerker vraagt om iets te doen dat niet mag (zoals data wijzigen, voertuigen aanpassen, ritten verwijderen), leg dan uit dat dit handmatig in de orderdetails moet worden gedaan.

## Jouw kennis en context

${contextSummary}

## Jouw taken

1. **Meedenken**: Analyseer de dagplanning en geef advies over de beste aanpak. Denk aan:
   - Combineren van ritten naar dezelfde regio
   - Optimale volgorde van leveringen/ophalingen
   - Capaciteit van transportmiddelen (bakwagens en aanhangers)
   - Beschikbaarheid van chauffeurs
   - Tijdvensters en haalbaarheid

2. **Toewijzingen doorvoeren**: Als de medewerker akkoord gaat, maak een actieplan met ALLEEN toegestane acties.

**KRITIEK: Gebruik ALTIJD de EXACTE UUID-id's uit de context hieronder. Kopieer ze letterlijk — verzin NOOIT een UUID.**

\`\`\`json:actieplan
{
  "actions": [
    {
      "type": "assign_transport",
      "orderId": "uuid-van-order",
      "segment": "leveren",
      "transportId": "uuid-van-transport",
      "driverId": "uuid-van-chauffeur"
    },
    {
      "type": "update_order",
      "orderId": "uuid-van-order",
      "changes": {
        "notes": "bestaande notities | nieuwe notitie toegevoegd door planner"
      }
    }
  ],
  "summary": "Korte samenvatting van wat er gaat gebeuren"
}
\`\`\`

3. **Proactief signaleren**: Waarschuw voor tijdconflicten, capaciteitstekorten, ontbrekende chauffeurs.

## Communicatiestijl
- Spreek Nederlands
- Wees bondig maar volledig
- Gebruik opsommingen voor overzicht
- Geef concrete, actionable adviezen`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Te veel verzoeken, probeer het later opnieuw." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Krediet op, voeg tegoed toe." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI-fout" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("planning-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Onbekende fout" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildContextSummary(
  date: string,
  orders: any[],
  drivers: any[],
  transport: any[],
  combis: any[],
  assignments: any[],
  exceptions: any[],
  memoryItems: any[]
): string {
  const lines: string[] = [];

  // Memory/tips section first
  if (memoryItems.length > 0) {
    lines.push(`### 📌 Opgeslagen tips & instructies (${memoryItems.length}):`);
    lines.push(`**Houd altijd rekening met deze tips bij het plannen:**`);
    for (const m of memoryItems) {
      lines.push(`- [${m.category}] ${m.content}`);
    }
    lines.push('');
  }

  lines.push(`### Datum: ${date}`);
  lines.push(`### Orders (${orders.length}):`);

  for (const o of orders) {
    const vehicles = (o.vehicle_types || []) as { type: string; count: number }[];
    const vehicleStr = vehicles.map((v: any) => `${v.count}x ${v.type}`).join(", ");
    const delivDate = o.delivery_date || o.start_date;
    const pickDate = o.pickup_date || o.end_date;
    const delivTime = o.delivery_time || o.start_time;
    const pickTime = o.pickup_time || o.end_time;

    const orderAssignments = assignments.filter((a: any) => a.order_id === o.id);
    const assignedInfo = orderAssignments.length > 0
      ? ` | Toegewezen: ${orderAssignments.map((a: any) => `${a.segment}: transport=${a.transport_id}, chauffeur=${a.driver_id || 'geen'}`).join("; ")}`
      : " | Nog niet toegewezen";

    lines.push(`- **${o.order_number}** | orderId: \`${o.id}\` | Klant: ${o.company_name || `${o.first_name} ${o.last_name}`} | ${vehicleStr}`);
    lines.push(`  Leveren: ${delivDate} ${delivTime?.slice(0, 5) || '?'} → ${o.start_location}`);
    lines.push(`  Ophalen: ${pickDate} ${pickTime?.slice(0, 5) || '?'} → ${o.end_location}`);
    lines.push(`  ${assignedInfo}`);
    if (o.notes) lines.push(`  Notities: ${o.notes}`);
  }

  lines.push(`\n### Chauffeurs (${drivers.length}):`);
  for (const d of drivers) {
    const exc = exceptions.find((e: any) => e.driver_id === d.id);
    const status = exc ? (exc.is_available ? `beschikbaar ${exc.start_time}-${exc.end_time}` : `niet beschikbaar (${exc.exception_type})`) : "beschikbaar";
    lines.push(`- **${d.name}** | driverId: \`${d.id}\` | ${d.can_drive_trailer ? 'Kan aanhanger rijden' : 'Geen aanhanger'} | ${status}`);
  }

  lines.push(`\n### Transportmiddelen (${transport.length}):`);
  for (const t of transport) {
    const caps = [];
    if (t.capacity_choppers > 0) caps.push(`${t.capacity_choppers} choppers`);
    if (t.capacity_fatbikes > 0) caps.push(`${t.capacity_fatbikes} fatbikes`);
    if (t.capacity_bikes > 0) caps.push(`${t.capacity_bikes} bikes`);
    if (t.capacity_fietsen > 0) caps.push(`${t.capacity_fietsen} fietsen`);
    if (t.capacity_tweepers > 0) caps.push(`${t.capacity_tweepers} tweepers`);
    lines.push(`- **${t.name}** (${t.code}) | transportId: \`${t.id}\` | ${t.type} | Cap: ${caps.join(", ") || "geen"}`);
  }

  if (combis.length > 0) {
    lines.push(`\n### Combi's (${combis.length}):`);
    for (const c of combis) {
      const caps = [];
      if (c.capacity_choppers > 0) caps.push(`${c.capacity_choppers} choppers`);
      if (c.capacity_fatbikes > 0) caps.push(`${c.capacity_fatbikes} fatbikes`);
      if (c.capacity_bikes > 0) caps.push(`${c.capacity_bikes} bikes`);
      if (c.capacity_fietsen > 0) caps.push(`${c.capacity_fietsen} fietsen`);
      if (c.capacity_tweepers > 0) caps.push(`${c.capacity_tweepers} tweepers`);
      lines.push(`- **${c.name}** (${c.code}) | transportId: \`${c.id}\` | Cap: ${caps.join(", ") || "geen"}`);
    }
  }

  return lines.join("\n");
}
