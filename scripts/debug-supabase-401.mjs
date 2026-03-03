#!/usr/bin/env node
/**
 * Roept Supabase REST API aan met anon key uit .env en logt de ruwe response.
 * Gebruik: node scripts/debug-supabase-401.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env");
const envContent = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}

const url = (env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("VITE_SUPABASE_URL en VITE_SUPABASE_PUBLISHABLE_KEY moeten in .env staan.");
  process.exit(1);
}

const apiUrl = `${url}/rest/v1/orders?select=*&order=created_at.desc`;
console.log("Request URL:", apiUrl);
console.log("");

const res = await fetch(apiUrl, {
  method: "GET",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

const body = await res.text();
console.log("Status:", res.status, res.statusText);
console.log("Response headers:", Object.fromEntries(res.headers.entries()));
console.log("Response body:", body || "(leeg)");

let parsed;
try {
  parsed = JSON.parse(body);
  if (parsed.code) console.log("\nPostgREST error code:", parsed.code, "-", parsed.message);
  if (parsed.details) console.log("Details:", parsed.details);
  if (parsed.hint) console.log("Hint:", parsed.hint);
} catch (_) {}

process.exit(res.ok ? 0 : 1);
