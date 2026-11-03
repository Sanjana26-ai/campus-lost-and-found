import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { SAMPLE, filterItems, todayISO, validateReport, type Errors, type Item, type Kind } from "@/lib/items";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Campus Lost & Found" },
      { name: "description", content: "Search lost and found items on campus and report what you lost or found." },
      { property: "og:title", content: "Campus Lost & Found" },
      { property: "og:description", content: "Search lost and found items on campus and report what you lost or found." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => <div role="alert" className="p-8 text-center">{error instanceof Error ? error.message : String(error)}</div>,
  notFoundComponent: () => <div className="p-8 text-center">Not found.</div>,
  component: Index,
});



const empty = { kind: "lost" as Kind, name: "", description: "", location: "", date: "", contact: "" };

function Index() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [form, setForm] = useState(empty);
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [reports, setReports] = useState<Item[]>([]);
  const [storageReady, setStorageReady] = useState(false);

  // Standalone mode: reports are stored in this browser, not in a cloud database.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("campus-lost-found-reports");
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) setReports(parsed as Item[]);
      }
    } catch (error) {
      console.warn("Could not read saved reports from this browser.", error);
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem("campus-lost-found-reports", JSON.stringify(reports));
    } catch (error) {
      console.warn("Could not save reports in this browser.", error);
      setNotice("Storage is full. Try removing some uploaded content or clearing old browser data.");
    }
  }, [reports, storageReady]);
  const [saving, setSaving] = useState(false);

  const items = useMemo(() => [...reports, ...SAMPLE], [reports]);
  const visible = useMemo(() => filterItems(items, query, filter), [items, query, filter]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const errs = validateReport(form);
    setErrors(errs);
    setNotice("");
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const item: Item = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        contact: form.contact.trim(),
      };
      setReports((r) => [item, ...r]);
      setForm({ ...empty, kind: form.kind });
      setFilter("all");
      setQuery("");
      setNotice("Thanks! Your report was saved in this browser and is visible on this device.");
    } finally {
      setSaving(false);
    }
  };

  const err = (k: keyof Errors) => errors[k] && <p className="mt-1 text-xs text-destructive">{errors[k]}</p>;

  const field = "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
  const tab = (v: "all" | Kind, label: string) => (
    <button
      type="button"
      aria-pressed={filter === v}
      onClick={() => setFilter(v)}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${filter === v ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-10 text-center">
          <h1 className="text-4xl font-bold sm:text-5xl">Campus Lost & Found</h1>
          <p className="mt-2 opacity-90">Lost something? Found something? Help it get back home.</p>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by item, description or location…"
            aria-label="Search items"
            className="mx-auto mt-6 block w-full max-w-xl rounded-full bg-card px-5 py-3 text-foreground shadow-lg focus:outline-none focus:ring-4 focus:ring-accent"
          />
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_340px]">
        <section>
          <div className="mb-4 flex flex-wrap gap-2">
            {tab("all", "All Items")}
            {tab("lost", "Lost Items")}
            {tab("found", "Found Items")}
          </div>
          {visible.length === 0 ? (
            <p className="rounded-xl bg-muted p-8 text-center text-muted-foreground">No items match your search.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {visible.map((i) => (
                <article key={i.id} className="rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${i.kind === "lost" ? "bg-lost-soft text-lost" : "bg-found-soft text-found"}`}>
                    {i.kind}
                  </span>
                  <h3 className="mt-2 text-xl font-semibold">{i.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{i.description}</p>
                  <dl className="mt-3 space-y-1 text-sm">
                    <div>📍 {i.location}</div>
                    <div>📅 {new Date(i.date + "T00:00").toLocaleDateString(undefined, { dateStyle: "medium" })}</div>
                    <div className="break-all">✉️ {i.contact}</div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="h-fit rounded-2xl border bg-card p-5 shadow-sm lg:sticky lg:top-6">
          <h2 className="text-2xl font-semibold">Report an Item</h2>
          <form onSubmit={submit} noValidate className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Report type">
              {(["lost", "found"] as Kind[]).map((k) => (
                <button
                  type="button"
                  key={k}
                  aria-pressed={form.kind === k}
                  onClick={() => setForm({ ...form, kind: k })}
                  className={`rounded-lg py-2 text-sm font-semibold capitalize ${form.kind === k ? (k === "lost" ? "bg-lost text-primary-foreground" : "bg-found text-primary-foreground") : "bg-secondary"}`}
                >
                  I {k} it
                </button>
              ))}
            </div>
            <div><input aria-label="Item name" maxLength={60} className={field} placeholder="Item name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />{err("name")}</div>
            <div><textarea aria-label="Description" maxLength={300} rows={3} className={field} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />{err("description")}</div>
            <div><input aria-label="Location" maxLength={80} className={field} placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />{err("location")}</div>
            <div><input type="date" max={todayISO()} className={field} aria-label="Date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />{err("date")}</div>
            <div><input aria-label="Contact" maxLength={100} className={field} placeholder="Contact (email or phone)" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />{err("contact")}</div>
            <button type="submit" disabled={saving} className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
              {saving ? "Saving…" : "Submit Report"}
            </button>
            {notice && <p role="status" className="rounded-lg bg-found-soft p-3 text-sm text-found">{notice}</p>}
          </form>
        </aside>
      </main>
    </div>
  );
}
