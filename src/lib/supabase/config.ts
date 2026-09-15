/**
 * Supabase configuration and runtime boundary validation.
 * Distinguishes public-safe credentials from privileged server secrets.
 */

export interface SupabasePublicConfig {
  url: string | null;
  anonKey: string | null;
  isConfigured: boolean;
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || null;
  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey),
  };
}

export function getSupabaseServerServiceKey(): string | null {
  // Service role key must NEVER be exposed via NEXT_PUBLIC_*
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}
