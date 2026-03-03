import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { actions } = await req.json();
    if (!actions || !Array.isArray(actions)) {
      return new Response(JSON.stringify({ error: "Geen acties ontvangen" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results: { action: string; success: boolean; error?: string }[] = [];

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const action of actions) {
      try {
        // Validate that IDs are proper UUIDs
        const idsToCheck = ['orderId', 'transportId', 'driverId', 'assignmentId'];
        for (const field of idsToCheck) {
          const val = action[field];
          if (val && !uuidRegex.test(val)) {
            throw new Error(`Ongeldig ID-formaat voor ${field}: "${val}". Gebruik de UUID, niet het ordernummer of naam.`);
          }
        }

        switch (action.type) {
          case "assign_transport": {
            // Upsert an assignment in order_transport_assignments
            const { orderId, segment, transportId, driverId, sequenceNumber } = action;
            
            const seq = sequenceNumber || 1;
            const { data: existing } = await supabase
              .from("order_transport_assignments")
              .select("id")
              .eq("order_id", orderId)
              .eq("segment", segment)
              .eq("sequence_number", seq)
              .maybeSingle();

            if (existing) {
              const updateData: any = { transport_id: transportId };
              if (driverId) updateData.driver_id = driverId;
              const { error } = await supabase
                .from("order_transport_assignments")
                .update(updateData)
                .eq("id", existing.id);
              if (error) throw error;
            } else {
              const { error } = await supabase
                .from("order_transport_assignments")
                .insert({
                  order_id: orderId,
                  segment,
                  transport_id: transportId,
                  driver_id: driverId || null,
                  sequence_number: seq,
                });
              if (error) throw error;
            }
            results.push({ action: `assign_transport ${segment} voor order`, success: true });
            break;
          }

          case "assign_driver": {
            const { assignmentId, driverId, orderId, segment } = action;
            
            if (assignmentId) {
              const { error } = await supabase
                .from("order_transport_assignments")
                .update({ driver_id: driverId })
                .eq("id", assignmentId);
              if (error) throw error;
            } else if (orderId && segment) {
              const { error } = await supabase
                .from("order_transport_assignments")
                .update({ driver_id: driverId })
                .eq("order_id", orderId)
                .eq("segment", segment);
              if (error) throw error;
            }
            results.push({ action: `assign_driver`, success: true });
            break;
          }

          case "update_order": {
            const { orderId, changes } = action;
            if (!orderId || !changes) throw new Error("orderId en changes vereist");
            
            // STRICT: Only notes field is allowed via AI chat
            const safeChanges: Record<string, any> = {};
            if (changes.notes !== undefined) {
              // Fetch existing notes to ensure we don't lose them
              const { data: currentOrder } = await supabase
                .from("orders")
                .select("notes")
                .eq("id", orderId)
                .single();
              
              const existingNotes = currentOrder?.notes || '';
              const newNotes = changes.notes || '';
              
              // If AI sent notes that don't include existing notes, append instead
              if (existingNotes && !newNotes.includes(existingNotes)) {
                safeChanges.notes = existingNotes + ' | ' + newNotes;
              } else {
                safeChanges.notes = newNotes;
              }
            }

            // Block all other fields
            const blockedFields = Object.keys(changes).filter(k => k !== 'notes');
            if (blockedFields.length > 0) {
              throw new Error(`Niet toegestaan om deze velden te wijzigen via AI: ${blockedFields.join(', ')}. Doe dit handmatig in de orderdetails.`);
            }
            
            if (Object.keys(safeChanges).length === 0) {
              throw new Error("Geen geldige velden om bij te werken");
            }

            const { error } = await supabase
              .from("orders")
              .update(safeChanges)
              .eq("id", orderId);
            if (error) throw error;
            results.push({ action: `update_order (notities)`, success: true });
            break;
          }

          case "remove_assignment":
          case "split_delivery":
            throw new Error(`Actie "${action.type}" is niet toegestaan via de AI-assistent. Verwijder of splits ritten handmatig.`);

          default:
            results.push({ action: action.type, success: false, error: `Onbekend actietype: ${action.type}` });
        }
      } catch (e) {
        console.error(`Action error (${action.type}):`, e);
        results.push({
          action: action.type,
          success: false,
          error: e instanceof Error ? e.message : "Onbekende fout",
        });
      }
    }

    const allSuccess = results.every(r => r.success);
    const successCount = results.filter(r => r.success).length;

    return new Response(JSON.stringify({
      success: allSuccess,
      message: allSuccess
        ? `Alle ${successCount} acties succesvol uitgevoerd`
        : `${successCount}/${results.length} acties gelukt`,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("execute-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Onbekende fout" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
