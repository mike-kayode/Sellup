"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabaseClient();
        const url = new URL(window.location.href);
        const next = url.searchParams.get("next") || "/onboarding";
        const code = url.searchParams.get("code");
        const errorDescription = url.searchParams.get("error_description") || url.searchParams.get("error");

        if (errorDescription) {
          throw new Error(errorDescription);
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;
        if (!session) {
          // detectSessionInUrl may have already handled it; give it a moment.
          await new Promise((r) => setTimeout(r, 300));
          const retry = await supabase.auth.getSession();
          if (!retry.data.session) throw new Error("Could not complete sign in. Please try again.");
        }

        const activeSession = (await supabase.auth.getSession()).data.session;
        if (activeSession?.access_token) {
          // Ensure our users table record exists for OAuth sign-ins.
          await fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${activeSession.access_token}` },
          }).catch(() => null);
        }

        if (!cancelled) {
          router.replace(next.startsWith("/") ? next : "/onboarding");
          router.refresh();
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to complete sign in.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf7f2] px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {error ? (
          <>
            <h1 className="text-xl font-extrabold text-slate-900">Sign in failed</h1>
            <p className="mt-2 text-sm text-red-600">{error}</p>
            <a href="/login" className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Back to sign in
            </a>
          </>
        ) : (
          <>
            <h1 className="text-xl font-extrabold text-slate-900">Completing sign in…</h1>
            <p className="mt-2 text-sm text-slate-600">Please wait while we set up your account.</p>
          </>
        )}
      </div>
    </div>
  );
}
