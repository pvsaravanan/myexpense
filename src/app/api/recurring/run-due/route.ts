import { json, withUser } from "@/lib/api";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { postDueRecurring } from "@/lib/recurring";

/**
 * Post any due auto-post recurring rules for the current user.
 *
 * This used to run inside the app layout's render, which meant a database write
 * on every page render (including Next.js RSC prefetches) and a race that could
 * duplicate transactions. It is now an explicit POST, called once per session
 * by the client, and `postOccurrence` holds an optimistic lock regardless.
 */
export const POST = withUser(async (user, req) => {
  // Cheap guard so a client loop cannot hammer this.
  const check = rateLimit(clientKey(req as Request, `run-due:${user.id}`), 5, 60_000);
  if (!check.ok) return json({ posted: 0, throttled: true });

  const posted = await postDueRecurring(user.id, new Date());
  return json({ posted });
});
