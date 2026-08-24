import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for privileged server-side work (e.g. Storage
 * uploads to the avatars bucket). Bypasses RLS, so it must ONLY ever be used
 * from server code — never expose the service-role key to the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
