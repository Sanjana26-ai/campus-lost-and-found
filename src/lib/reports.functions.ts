import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { SAMPLE, normalizeMatches, validateReport, type Item, type Match, type ReportInput } from "./items";
import { findMatchesWithAI, MatchError } from "./match.server";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

type Row = Database["public"]["Tables"]["reports"]["Row"];
const toItem = (r: Row): Item => ({
  id: r.id, kind: r.kind as Item["kind"], name: r.name, description: r.description,
  location: r.location, date: r.item_date, contact: r.contact,
});

export const listReports = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient()
    .from("reports")
    .select("id, kind, name, description, location, item_date, contact, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("listReports", error);
    return { items: [] as Item[], error: "Couldn't load reports right now." };
  }
  return { items: (data ?? []).map(toItem), error: null as string | null };
});

export const createReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown): ReportInput => {
    const o = (d ?? {}) as Record<string, unknown>;
    const s = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
    return { kind: s("kind") as ReportInput["kind"], name: s("name"), description: s("description"), location: s("location"), date: s("date"), contact: s("contact") };
  })
  .handler(async ({ data }) => {
    // Allow one day of slack for visitors in timezones ahead of the server.
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const errors = validateReport(data, tomorrow);
    if (Object.keys(errors).length) return { ok: false as const, errors, item: null };
    const { data: row, error } = await publicClient()
      .from("reports")
      .insert({
        kind: data.kind, name: data.name.trim(), description: data.description.trim(),
        location: data.location.trim(), item_date: data.date, contact: data.contact.trim(),
      })
      .select("id, kind, name, description, location, item_date, contact, created_at")
      .single();
    if (error || !row) {
      console.error("createReport", error);
      return { ok: false as const, errors: { name: "Couldn't save your report. Please try again." }, item: null };
    }
    return { ok: true as const, errors: {}, item: toItem(row) };
  });

export const findMatches = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as Record<string, unknown>;
    const kind = o["kind"] === "found" ? "found" : "lost";
    const description = typeof o["description"] === "string" ? (o["description"] as string).trim() : "";
    return { kind, description } as { kind: "lost" | "found"; description: string };
  })
  .handler(async ({ data }) => {
    if (data.description.length < 5 || data.description.length > 300) {
      return { matches: [] as Match[], error: "Describe the item in 5 to 300 characters." };
    }
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { matches: [] as Match[], error: "AI matching isn't set up yet." };
    const { data: rows } = await publicClient()
      .from("reports")
      .select("id, kind, name, description, location, item_date, contact, created_at")
      .order("created_at", { ascending: false })
      .limit(150);
    const candidates = [...(rows ?? []).map(toItem), ...SAMPLE];
    try {
      const raw = await findMatchesWithAI(apiKey, data.kind, data.description, candidates);
      return { matches: normalizeMatches(raw, candidates), error: null as string | null };
    } catch (e) {
      return { matches: [] as Match[], error: e instanceof MatchError ? e.message : "AI matching failed. Please try again later." };
    }
  });
