"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Phone, User } from "lucide-react";
import { AuthShowcase } from "@/components/auth-showcase";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    phone: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    // Validate
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          phone: formData.phone || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      // Email the 6-digit code was sent — collect it on /verify.
      router.push(`/verify?email=${encodeURIComponent(formData.email)}`);
    } catch (err) {
      setError("Failed to register. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#faf7f2] lg:grid lg:grid-cols-2">
      {/* Left — photo panel (split-screen) */}
      <AuthShowcase
        badge="Trusted by sellers"
        headline={
          <>
            Real stores. Real orders.
            <br />
            <span className="text-[#25D366]">No wahala.</span>
          </>
        }
        subtext="Thousands of Nigerian sellers already run their business on Sell Up. Create yours in under 10 minutes."
        question="Already have an account?"
        switchLabel="Log in instead"
        switchHref="/login"
      />

      {/* Right — form panel */}
      <div className="flex items-center justify-center px-5 py-10 sm:px-8 lg:py-14">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            Create your store
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Free plan, ₦0 upfront. Upgrade whenever you&apos;re ready.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

          {/* Full Name */}
          <div>
            <label
              htmlFor="fullName"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"
            >
              Full Name
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
                className="input pl-11"
                placeholder="Your full name"
                required
                disabled={loading}
                minLength={2}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="register-email"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="register-email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="input pl-11"
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="phone"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"
            >
              Phone Number (Optional)
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="input pl-11"
                placeholder="+234 800 000 0000"
                disabled={loading}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="register-password"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="register-password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="input pl-11 pr-11"
                placeholder="Minimum 8 characters"
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
            <p className="mt-1.5 text-xs text-slate-500">
              Minimum 8 characters
            </p>
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="register-confirm-password"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"
            >
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="register-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                className="input pl-11 pr-11"
                placeholder="Repeat your password"
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Terms */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="terms"
              required
              disabled={loading}
              className="mt-1 h-4 w-4 accent-[#25D366]"
            />
            <label htmlFor="terms" className="text-sm text-slate-600">
              I agree to the{" "}
              <a href="#" className="font-semibold text-[#128C7E]">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="font-semibold text-[#128C7E]">
                Privacy Policy
              </a>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? "Creating Account..." : "Create Account"}{" "}
            <ArrowRight size={18} />
          </button>
        </form>

        {/* Sign In Link */}
        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-[#128C7E] hover:underline"
          >
            Sign in
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
