"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { AuthShowcase } from "@/components/auth-showcase";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Success banners from /verify (verified=1) and legacy ?registered=1.
  // Deferred via timeout so state isn't set synchronously inside the effect.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next =
      params.get("verified") === "1"
        ? "Email verified! You can now sign in."
        : params.get("registered") === "1"
          ? "Account created. Please sign in."
          : "";
    if (!next) return;
    const id = setTimeout(() => setNotice(next), 0);
    return () => clearTimeout(id);
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const message = (error.message || "").toLowerCase();
        if (
          error.code === "email_not_confirmed" ||
          message.includes("email not confirmed")
        ) {
          setError(
            "Your email hasn't been verified yet. Check your inbox for your 6-digit code."
          );
          setNeedsVerification(true);
          setLoading(false);
          return;
        }
        setError("Invalid email or password");
        setLoading(false);
        return;
      }
      setNeedsVerification(false);

      const user = data.user;
      const metaRole = user.user_metadata?.role as string | undefined;
      if (metaRole === "admin" || metaRole === "superadmin") {
        router.push("/my-admin");
      } else {
        // Fallback: admins whose auth metadata is missing/stale still route
        // correctly when the users table lists them as admin/superadmin.
        try {
          const meRes = await fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
          });
          const me = meRes.ok ? await meRes.json() : null;
          const serverRole = me?.user?.role as string | undefined;
          if (serverRole === "admin" || serverRole === "superadmin") {
            router.push("/my-admin");
          } else {
            router.push("/dashboard");
          }
        } catch {
          router.push("/dashboard");
        }
      }
      router.refresh();
    } catch (err) {
      setError("Failed to login. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#faf7f2] lg:grid lg:grid-cols-2">
      {/* Left — photo panel (split-screen) */}
      <AuthShowcase
        badge="Welcome back"
        headline={
          <>
            Your store is still
            <br />
            <span className="text-[#25D366]">selling. No wahala.</span>
          </>
        }
        subtext="Sign in to manage your products, orders and customers — all in one place."
        question="New to Sell Up?"
        switchLabel="Create an account"
        switchHref="/register"
      />

      {/* Right — form panel */}
      <div className="flex items-center justify-center px-5 py-10 sm:px-8 lg:py-14">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            Welcome back
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sign in to your Sell Up account.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            {notice && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                {notice}
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
                {needsVerification && (
                  <Link
                    href={`/verify?email=${encodeURIComponent(email)}`}
                    className="mt-2 block font-semibold underline"
                  >
                    Enter your verification code &rarr;
                  </Link>
                )}
              </div>
            )}

          {/* Email */}
          <div>
            <label
              htmlFor="login-email"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input pl-11"
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="login-password"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pl-11 pr-11"
                placeholder="Your password"
                required
                disabled={loading}
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"} <ArrowRight size={18} />
          </button>
        </form>

        {/* Sign Up Link */}
        <p className="mt-6 text-center text-sm text-slate-600">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-[#128C7E] hover:underline"
          >
            Create one
          </Link>
        </p>

        {/* Back to Home */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            ← Back to Home
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
}
