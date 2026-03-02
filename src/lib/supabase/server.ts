import { cookies } from "next/headers";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";

export async function createSupabaseRouteHandlerClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options?: Record<string, unknown>) => {
          cookieStore.set(name, value, options as never);
        },
        remove: (name: string, options?: Record<string, unknown>) => {
          cookieStore.set(name, "", {
            ...(options || {}),
            maxAge: 0,
          } as never);
        },
      },
    },
  );
}

export async function requireUser() {
  const supabase = await createSupabaseRouteHandlerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { supabase, user: null };
  }
  return { supabase, user: data.user };
}
