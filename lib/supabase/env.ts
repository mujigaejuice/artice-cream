/** Fail loudly at boot rather than with an opaque 401 on the first query. */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

// The value has to be passed in, not looked up by name: Next only inlines
// NEXT_PUBLIC_* into the browser bundle on static property access, so
// `process.env[name]` would leave the client with nothing to read.
export const SUPABASE_URL = () =>
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = () =>
  required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
export const SUPABASE_SERVICE_ROLE_KEY = () =>
  required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
