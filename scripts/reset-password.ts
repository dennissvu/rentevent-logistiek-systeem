/**
 * Reset het wachtwoord van een gebruiker (dennis@xids.nl) via Supabase Admin API.
 *
 * Gebruik:
 *   SUPABASE_SERVICE_ROLE_KEY=<je-service-role-key> npx tsx scripts/reset-password.ts
 *
 * De service_role key vind je in Supabase Dashboard → Settings → API → service_role (secret).
 * Gebruik deze key NOOIT in de frontend of in git.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://arjwbnqhitjqolmenyel.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("Geef SUPABASE_SERVICE_ROLE_KEY mee (Supabase Dashboard → Settings → API → service_role).");
  process.exit(1);
}

const email = process.argv[2] || "dennis@xids.nl";
const newPassword = process.argv[3] || "TestWachtwoord123!";

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    console.error("Gebruikers ophalen mislukt:", listError.message);
    process.exit(1);
  }

  const user = listData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error(`Geen gebruiker gevonden met e-mail: ${email}`);
    process.exit(1);
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });

  if (updateError) {
    console.error("Wachtwoord bijwerken mislukt:", updateError.message);
    process.exit(1);
  }

  console.log(`Wachtwoord voor ${email} is gereset.`);
  console.log(`Nieuw wachtwoord: ${newPassword}`);
}

main();
