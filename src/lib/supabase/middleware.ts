import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request and forwards the updated
 * auth cookies. Must run in middleware so Server Components always see a fresh
 * session. Do not add logic between createServerClient and getUser().
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // No-op until a real anon key is configured (real Supabase keys are JWTs that
  // start with "eyJ"). Prevents failing auth calls on every request while the
  // migration is mid-setup.
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey || !anonKey.startsWith("eyJ")) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Touch the user so the session token is refreshed and re-issued via cookies.
  await supabase.auth.getUser();

  return response;
}
