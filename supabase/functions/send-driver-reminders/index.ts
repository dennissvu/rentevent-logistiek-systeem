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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_WHATSAPP_FROM = (Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "").replace(/[\s\-()]/g, "");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
      return new Response(
        JSON.stringify({
          error: "Twilio credentials not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM secrets.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const dayOfWeek = tomorrow.getDay(); // 0=Sun, 1=Mon...

    // 1. Fetch active drivers with phone numbers
    const { data: drivers, error: driversErr } = await supabase
      .from("drivers")
      .select("*")
      .eq("is_active", true);
    if (driversErr) throw driversErr;

    const driversWithPhone = (drivers || []).filter(
      (d: any) => d.phone && d.phone.trim() !== ""
    );

    if (driversWithPhone.length === 0) {
      return new Response(
        JSON.stringify({ message: "No drivers with phone numbers found." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check schedule exceptions for tomorrow
    const driverIds = driversWithPhone.map((d: any) => d.id);
    const { data: exceptions } = await supabase
      .from("driver_schedule_exceptions")
      .select("*")
      .in("driver_id", driverIds)
      .eq("exception_date", tomorrowStr);

    const exceptionMap = new Map(
      (exceptions || []).map((e: any) => [e.driver_id, e])
    );

    // 3. Fetch weekly schedules for tomorrow's day
    const { data: schedules } = await supabase
      .from("driver_weekly_schedules")
      .select("*")
      .in("driver_id", driverIds)
      .eq("day_of_week", dayOfWeek);

    const scheduleMap = new Map(
      (schedules || []).map((s: any) => [s.driver_id, s])
    );

    // 4. Fetch orders for tomorrow
    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .in("status", ["bevestigd", "optie"]);

    const tomorrowOrders = (orders || []).filter((o: any) => {
      const deliveryDate = o.delivery_date || o.start_date;
      const pickupDate = o.pickup_date || o.end_date;
      return deliveryDate === tomorrowStr || pickupDate === tomorrowStr;
    });

    const orderIds = tomorrowOrders.map((o: any) => o.id);

    // 5. Fetch assignments for tomorrow's orders
    let assignments: any[] = [];
    if (orderIds.length > 0) {
      const { data } = await supabase
        .from("order_transport_assignments")
        .select("*")
        .in("order_id", orderIds)
        .order("sequence_number");
      assignments = data || [];
    }

    const orderMap = new Map(tomorrowOrders.map((o: any) => [o.id, o]));

    // 6. Build messages and send per driver
    const results: any[] = [];

    for (const driver of driversWithPhone) {
      // Check if driver is available tomorrow
      const exception = exceptionMap.get(driver.id);
      if (exception && !exception.is_available) {
        continue; // Driver has day off, skip
      }

      const schedule = scheduleMap.get(driver.id);
      if (!exception && schedule && !schedule.is_working) {
        continue; // Not scheduled to work, skip
      }

      // Determine start time
      let startTime = "onbekend";
      if (exception && exception.start_time) {
        startTime = exception.start_time.slice(0, 5);
      } else if (schedule && schedule.start_time_1) {
        startTime = schedule.start_time_1.slice(0, 5);
      }

      // Get driver's assignments for tomorrow
      const driverAssignments = assignments.filter((a: any) => {
        if (a.driver_id !== driver.id) return false;
        const order = orderMap.get(a.order_id);
        if (!order) return false;
        const deliveryDate = order.delivery_date || order.start_date;
        const pickupDate = order.pickup_date || order.end_date;
        if (a.segment === "leveren" && deliveryDate === tomorrowStr) return true;
        if (a.segment === "ophalen" && pickupDate === tomorrowStr) return true;
        return false;
      });

      // Build trip summary
      const trips = driverAssignments.map((a: any) => {
        const order = orderMap.get(a.order_id);
        const customerName =
          order.company_name || `${order.first_name} ${order.last_name}`;
        const isLeveren = a.segment === "leveren";
        const location = isLeveren ? order.start_location : order.end_location;
        const time = isLeveren
          ? (order.delivery_time || order.start_time)?.slice(0, 5)
          : (order.pickup_time || order.end_time)?.slice(0, 5);
        return `• ${time} - ${isLeveren ? "Leveren" : "Ophalen"} bij ${customerName} (${location})`;
      });

      // Sort by time
      trips.sort();

      // Build WhatsApp message
      let message = `Hoi ${driver.name}! 👋\n\nHerinnering: je werkt morgen (${tomorrowStr}).\n`;
      message += `Starttijd: ${startTime}\n`;

      if (trips.length > 0) {
        message += `\n📋 Ritten (${trips.length}):\n`;
        message += trips.join("\n");
      } else {
        message += `\nEr staan nog geen ritten ingepland.`;
      }

      message += `\n\nSucces! 🚛`;

      // Format phone for WhatsApp (ensure +31 format)
      let phone = driver.phone.replace(/[\s\-()]/g, "");
      if (phone.startsWith("06")) {
        phone = "+31" + phone.slice(1);
      } else if (phone.startsWith("6")) {
        phone = "+31" + phone;
      } else if (!phone.startsWith("+")) {
        phone = "+31" + phone;
      }

      // Send via Twilio
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      const body = new URLSearchParams({
        From: `whatsapp:${TWILIO_WHATSAPP_FROM}`,
        To: `whatsapp:${phone}`,
        Body: message,
      });

      const twilioResp = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization:
            "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      const twilioResult = await twilioResp.json();

      results.push({
        driver: driver.name,
        phone,
        sent: twilioResp.ok,
        sid: twilioResult.sid || null,
        error: twilioResp.ok ? null : twilioResult.message,
      });
    }

    return new Response(
      JSON.stringify({
        date: tomorrowStr,
        reminders_sent: results.filter((r: any) => r.sent).length,
        reminders_failed: results.filter((r: any) => !r.sent).length,
        details: results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending reminders:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
