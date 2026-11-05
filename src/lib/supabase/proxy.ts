import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
// import type { Database } from "@/lib/types/supabase";

type SetAllCookies = NonNullable<CookieMethodsServer["setAll"]>;

function getProxySupabaseConfig(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }

  if (!anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  }

  return { url, anonKey };
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  if (request.nextUrl.pathname === '/bhojan/scan' || request.nextUrl.pathname.startsWith('/bhojan/') || request.nextUrl.pathname === '/api/bhojan/validate') {
    return NextResponse.next({ request });
  }
  let supabaseResponse: NextResponse = NextResponse.next({ request });

  const { url, anonKey } = getProxySupabaseConfig();

  const supabase = await createServerClient(
    url,
    anonKey,
    {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
      },
    },
    }
  );

  try {
    await supabase.auth.getClaims();
  } catch (error) {
    console.error("Failed to resolve Supabase session claims", error);
  }

  return supabaseResponse;
}
