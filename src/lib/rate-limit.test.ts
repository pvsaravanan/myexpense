import { describe, expect, it } from "vitest";
import { clientKey, rateLimit, resetRateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("allows up to the limit then blocks", () => {
    const key = `t1-${Math.random()}`;
    for (let i = 0; i < 5; i++) expect(rateLimit(key, 5, 60_000).ok).toBe(true);
    const blocked = rateLimit(key, 5, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("reports remaining attempts", () => {
    const key = `t2-${Math.random()}`;
    expect(rateLimit(key, 3, 60_000).remaining).toBe(2);
    expect(rateLimit(key, 3, 60_000).remaining).toBe(1);
    expect(rateLimit(key, 3, 60_000).remaining).toBe(0);
  });

  it("keeps separate counters per key", () => {
    const a = `t3a-${Math.random()}`;
    const b = `t3b-${Math.random()}`;
    rateLimit(a, 1, 60_000);
    expect(rateLimit(a, 1, 60_000).ok).toBe(false);
    expect(rateLimit(b, 1, 60_000).ok).toBe(true);
  });

  it("resets a key on demand (successful login)", () => {
    const key = `t4-${Math.random()}`;
    rateLimit(key, 1, 60_000);
    expect(rateLimit(key, 1, 60_000).ok).toBe(false);
    resetRateLimit(key);
    expect(rateLimit(key, 1, 60_000).ok).toBe(true);
  });

  it("starts a fresh window once the old one expires", () => {
    const key = `t5-${Math.random()}`;
    expect(rateLimit(key, 1, 1).ok).toBe(true);
    expect(rateLimit(key, 1, 1).ok).toBe(false);
    const start = Date.now();
    while (Date.now() - start < 5) { /* let the 1ms window lapse */ }
    expect(rateLimit(key, 1, 1).ok).toBe(true);
  });
});

describe("clientKey", () => {
  it("derives a scoped key from the trusted (rightmost) forwarding hop", () => {
    // The client can forge leftmost x-forwarded-for entries; only the hop our
    // own proxy appended (rightmost, with the default single trusted proxy) is
    // trustworthy, so a spoofed prefix must be ignored.
    const req = new Request("http://x/", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(clientKey(req, "login")).toBe("login:5.6.7.8");
  });

  it("prefers x-real-ip over x-forwarded-for", () => {
    const req = new Request("http://x/", {
      headers: { "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.2.3.4" },
    });
    expect(clientKey(req, "login")).toBe("login:9.9.9.9");
  });

  it("falls back when no ip header is present", () => {
    expect(clientKey(new Request("http://x/"), "login")).toBe("login:local");
  });
});
