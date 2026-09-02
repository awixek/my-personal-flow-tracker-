import { createBrowserClient } from "@supabase/ssr";

// Used in Client Components (the login form, dashboard interactivity, etc.)
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
