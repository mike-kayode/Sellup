"use client";

import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

type Step = "email" | "code";

function ForgotPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialEmail = params.get("email") || "";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const [digits, setDigits] = useState<string[]>(() =>
    Array(CODE_LENGTH).fill("")
  );
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const autoRef = useRef(false);

  const code = digits.join("");

  useEffect(() => {
    if (step !== "code" || cooldown <= 0) return;
    const t = setInterval(
      () => setCooldown((c) => (c <= 1 ? 0 : c - 1)),
      1000
    );
    return () => clearInterval(t);
  }, [step, cooldown]);

  useEffect(() => {
    if (step === "code") {
      inputsRef.current[0]?.focus();
    }
  }, [step]);

  async function handleRequestCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Unable to send reset code. Please try again.");
        return;
      }

      setInfo(
        data.message ||
          "If an account with that email exists, a password reset code has been sent."
      );
      setDigits(Array(CODE_LENGTH).fill(""));
      autoRef.current = false;
      setCooldown(RESEND_SECONDS);
      setStep("code");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const submitCode = useCallback(
    async (codeStr: string) => {
      if (!email || codeStr.length !== CODE_LENGTH || verifying) return;
      setVerifying(true);
      setError("");
      try {
        const res = await fetch("/api/auth/verify-reset-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: codeStr }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Verification failed. Please try again.");
          setDigits(Array(CODE_LENGTH).fill(""));
          autoRef.current = false;
          setTimeout(() => inputsRef.current[0]?.focus(), 0);
          return;
        }
        if (!data.token) {
          setError("Unable to continue. Please request a new code.");
          return;
        }
        router.push(`/reset-password?token=${encodeURIComponent(data.token)}`);
      } catch {
        setError("Network error. Please try again.");
        autoRef.current = false;
      } finally {
        setVerifying(false);
      }
    },
    [email, verifying, router]
  );

  useEffect(() => {
    if (step !== "code") return;
    if (code.length < CODE_LENGTH) {
      autoRef.current = false;
      return;
    }
    if (!autoRef.current && !verifying) {
      autoRef.current = true;
      void submitCode(code);
    }
  }, [step, code, submitCode, verifying]);

  function setDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, "");
    setDigits((prev) => {
      const next = [...prev];
      if (clean.length > 1) {
        for (let i = 0; i < clean.length && index + i < CODE_LENGTH; i++) {
          next[index + i] = clean[i];
        }
      } else {
        next[index] = clean;
      }
      return next;
    });
    if (clean) {
      const target = Math.min(
        index + (clean.length > 1 ? clean.length : 1),
        CODE_LENGTH - 1
      );
      inputsRef.current[target]?.focus();
    }
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      e.preventDefault();
      setDigit(index - 1, "");
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      e.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = Array(CODE_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    inputsRef.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  }

  async function handleResend() {
    if (cooldown > 0 || resending || !email) return;
    setResending(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not resend the code.");
        return;
      }
      setInfo(
        data.message ||
          "If an account with that email exists, a password reset code has been sent."
      );
      setCooldown(RESEND_SECONDS);
      setDigits(Array(CODE_LENGTH).fill(""));
      autoRef.current = false;
      inputsRef.current[0]?.focus();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setResending(false);
    }
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
          <h1 className="text-3xl font-bold mb-2">
            {step === "email" ? "Forgot Password" : "Enter Reset Code"}
          </h1>
          <p className="text-gray-600 text-sm">
            {step === "email" ? (
              "Enter your email address and we'll send you a 6-digit code to reset your password."
            ) : (
              <>
                Enter the 6-digit code we sent to
                <br />
                <span className="font-semibold text-gray-900 break-all">
                  {email}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {info && !error && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm">
              {info}
            </div>
          )}

          {step === "email" ? (
            <form onSubmit={handleRequestCode} className="space-y-5">
              <div>
                <label
                  htmlFor="forgot-email"
                  className="block text-sm font-medium mb-2"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input pl-12"
                    placeholder="you@example.com"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "Sending code..." : "Send Reset Code"}{" "}
                <ArrowRight size={20} />
              </button>
            </form>
          ) : (
            <>
              <div
                className="flex justify-center gap-2 sm:gap-3"
                onPaste={handlePaste}
              >
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputsRef.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    maxLength={CODE_LENGTH}
                    value={digit}
                    onChange={(e) => setDigit(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    disabled={verifying}
                    aria-label={`Digit ${index + 1}`}
                    className="w-11 h-13 sm:w-12 sm:h-14 text-center text-2xl font-bold border border-gray-300 rounded-xl focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/30 outline-none transition-colors disabled:bg-gray-50"
                  />
                ))}
              </div>

              <p className="text-xs text-gray-500 text-center">
                The code expires in 10 minutes. Check your spam folder if you
                don&apos;t see it.
              </p>

              <button
                type="button"
                onClick={() => {
                  autoRef.current = true;
                  void submitCode(code);
                }}
                disabled={code.length !== CODE_LENGTH || verifying}
                className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {verifying ? "Verifying..." : "Continue"}{" "}
                <ArrowRight size={20} />
              </button>

              <div className="text-center text-sm text-gray-600">
                Didn&apos;t get the code?{" "}
                {cooldown > 0 ? (
                  <span className="text-gray-400">
                    Resend in {Math.floor(cooldown / 60)}:
                    {String(cooldown % 60).padStart(2, "0")}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleResend()}
                    disabled={resending}
                    className="text-[#25D366] font-semibold hover:underline disabled:opacity-50"
                  >
                    {resending ? "Sending..." : "Resend code"}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setError("");
                  setInfo("");
                  setDigits(Array(CODE_LENGTH).fill(""));
                  autoRef.current = false;
                }}
                className="w-full flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                <ArrowLeft size={16} /> Use a different email
              </button>
            </>
          )}
        </div>

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

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-green-50" />
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
