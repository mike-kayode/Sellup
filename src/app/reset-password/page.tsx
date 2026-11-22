"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Your reset session is missing or invalid. Please start again.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to reset password. Please try again.");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-green-50 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- local PNG logo */}
            <img
              src="/assets/sellup-logo.png"
              alt="Sell Up"
              className="h-9 w-auto"
            />
          </div>
          <h1 className="text-xl font-bold">Reset session required</h1>
          <p className="text-gray-600 text-sm">
            Your password reset session is missing or has expired. Please
            request a new 6-digit code to continue.
          </p>
          <Link href="/forgot-password" className="inline-block w-full btn-primary">
            Request a new code
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-green-50 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center space-y-4">
          <div className="flex items-center justify-center">
            <CheckCircle2 size={56} className="text-[#25D366]" />
          </div>
          <h1 className="text-2xl font-bold">Password reset!</h1>
          <p className="text-gray-600 text-sm">
            Your password has been updated. Taking you to sign in&hellip;
          </p>
          <Link href="/login" className="inline-block w-full btn-primary">
            Continue to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-green-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element -- local PNG logo */}
            <img
              src="/assets/sellup-logo.png"
              alt="Sell Up"
              className="h-9 w-auto"
            />
          </div>
          <h1 className="text-3xl font-bold mb-2">Create New Password</h1>
          <p className="text-gray-600 text-sm">
            Choose a new password for your Sell Up account.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-gray-100"
        >
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
              {(error.toLowerCase().includes("expired") ||
                error.toLowerCase().includes("invalid")) && (
                <Link
                  href="/forgot-password"
                  className="mt-2 block font-semibold underline"
                >
                  Request a new code &rarr;
                </Link>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="new-password"
              className="block text-sm font-medium mb-2"
            >
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pl-12 pr-12"
                placeholder="Minimum 8 characters"
                required
                disabled={loading}
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium mb-2"
            >
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input pl-12 pr-12"
                placeholder="Re-enter your new password"
                required
                disabled={loading}
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? "Resetting password..." : "Reset Password"}{" "}
            <ArrowRight size={20} />
          </button>
        </form>

        <p className="text-center text-gray-600 mt-6 text-sm">
          Remember your password?{" "}
          <Link
            href="/login"
            className="text-[#25D366] font-semibold hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-green-50" />
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
