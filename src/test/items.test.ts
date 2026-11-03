import { describe, it, expect } from "vitest";
import { validateReport, filterItems, type Item } from "@/lib/items";

const ok = { kind: "lost" as const, name: "Bottle", description: "Blue bottle", location: "Library", date: "2026-10-20", contact: "a@b.edu" };

describe("validateReport", () => {
  it("accepts a valid report", () => expect(validateReport(ok, "2026-10-22")).toEqual({}));
  it("rejects whitespace-only name", () => expect(validateReport({ ...ok, name: "   " }, "2026-10-22").name).toBeDefined());
  it("requires location", () => expect(validateReport({ ...ok, location: "" }, "2026-10-22").location).toBeDefined());
  it("rejects future dates", () => expect(validateReport({ ...ok, date: "2026-10-23" }, "2026-10-22").date).toBeDefined());
  it("rejects invalid contact", () => expect(validateReport({ ...ok, contact: "hello" }, "2026-10-22").contact).toBeDefined());
  it("accepts a phone contact", () => expect(validateReport({ ...ok, contact: "+91 98765 43210" }, "2026-10-22").contact).toBeUndefined());
  it("rejects unknown kind", () => expect(validateReport({ ...ok, kind: "x" as never }, "2026-10-22").kind).toBeDefined());
});

describe("filterItems", () => {
  const items: Item[] = [
    { ...ok, id: "1" },
    { ...ok, id: "2", kind: "found", name: "Keys", description: "Red lanyard", location: "Parking" },
  ];
  it("found filter shows only found", () => expect(filterItems(items, "", "found").map((i) => i.id)).toEqual(["2"]));
  it("search combines with filter", () => expect(filterItems(items, "library", "found")).toEqual([]));
  it("search is case-insensitive", () => expect(filterItems(items, "KEYS", "all").map((i) => i.id)).toEqual(["2"]));
});
