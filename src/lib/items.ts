export type Kind = "lost" | "found";
export type Item = { id: string; kind: Kind; name: string; description: string; location: string; date: string; contact: string };
export type ReportInput = Omit<Item, "id">;
export type Errors = Partial<Record<keyof ReportInput, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s()-]{7,20}$/;

export function todayISO(now = new Date()) {
  const d = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
}

export function validateReport(f: ReportInput, today = todayISO()): Errors {
  const e: Errors = {};
  const len = (k: keyof ReportInput, label: string, min: number, max: number) => {
    const v = String(f[k]).trim();
    if (!v) e[k] = `${label} is required.`;
    else if (v.length < min) e[k] = `${label} must be at least ${min} characters.`;
    else if (v.length > max) e[k] = `${label} must be under ${max} characters.`;
  };
  if (f.kind !== "lost" && f.kind !== "found") e.kind = "Choose lost or found.";
  len("name", "Item name", 2, 60);
  len("description", "Description", 5, 300);
  len("location", "Location", 2, 80);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) e.date = "Pick a date.";
  else if (f.date > today) e.date = "Date can't be in the future.";
  const c = f.contact.trim();
  if (!c) e.contact = "Contact is required.";
  else if (c.length > 100) e.contact = "Contact must be under 100 characters.";
  else if (!EMAIL.test(c) && !PHONE.test(c)) e.contact = "Enter a valid email or phone number.";
  return e;
}

export function filterItems(items: Item[], query: string, filter: "all" | Kind) {
  const q = query.trim().toLowerCase();
  return items.filter(
    (i) =>
      (filter === "all" || i.kind === filter) &&
      (!q || [i.name, i.description, i.location, i.contact].some((x) => x.toLowerCase().includes(q))),
  );
}

export const SAMPLE: Item[] = [
  { id: "s1", kind: "lost", name: "Blue Water Bottle", description: "Hydro Flask with stickers of mountains.", location: "Library, 2nd floor", date: "2026-10-20", contact: "priya@college.edu" },
  { id: "s2", kind: "found", name: "Student ID Card", description: "ID card for a Computer Science student.", location: "Cafeteria", date: "2026-10-21", contact: "Front desk, Admin Block" },
  { id: "s3", kind: "lost", name: "Black Backpack", description: "Contains a calculus textbook and charger.", location: "Gym locker room", date: "2026-10-19", contact: "rahul@college.edu" },
  { id: "s4", kind: "found", name: "AirPods Case", description: "White case, no earbuds inside.", location: "Lecture Hall B", date: "2026-10-22", contact: "+91 98765 43210" },
  { id: "s5", kind: "found", name: "Set of Keys", description: "Three keys on a red lanyard.", location: "Parking Lot C", date: "2026-10-18", contact: "security@college.edu" },
  { id: "s6", kind: "lost", name: "Scientific Calculator", description: "Casio fx-991, name written on back.", location: "Physics Lab", date: "2026-10-17", contact: "ananya@college.edu" },
];

export type Match = { item: Item; confidence: "high" | "medium" | "low"; reason: string };

/** Keep only matches that point at real candidates, drop duplicates, cap at 5, best first. */
export function normalizeMatches(raw: { id: string; confidence: string; reason: string }[], candidates: Item[]): Match[] {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const rank = { high: 0, medium: 1, low: 2 } as const;
  const seen = new Set<string>();
  const out: Match[] = [];
  for (const m of raw) {
    const item = byId.get(m.id);
    if (!item || seen.has(m.id)) continue;
    seen.add(m.id);
    const confidence = m.confidence === "high" || m.confidence === "medium" ? m.confidence : "low";
    out.push({ item, confidence, reason: m.reason.slice(0, 200) });
  }
  return out.sort((a, b) => rank[a.confidence] - rank[b.confidence]).slice(0, 5);
}
