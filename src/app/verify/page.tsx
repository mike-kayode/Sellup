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
import { ArrowRight, CheckCircle2 } from "lucide-react";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") || "";

  const [digits, setDigits] = useState<string[]>(() =>
    Array(CODE_LENGTH).fill("")
  );
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const autoRef = useRef(false);

  // Resend cooldown countdown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(
      () => setCooldown((c) => (c <= 1 ? 0 : c - 1)),
      1000
    );
    return () => clearInterval(t);
  }, [cooldown]);

  // Focus the first box on mount.
  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const code = digits.join("");

  const submitCode = useCallback(
    async (codeStr: string) => {
      if (!email || codeStr.length !== CODE_LENGTH || verifying || verified) {
        return;
      }
      setVerifying(true);
      setError("");
      try {
        const res = await fetch("/api/auth/verify", {
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
        setVerified(true);
        setTimeout(() => router.push("/login?verified=1"), 1500);
      } catch {
        setError("Network error. Please try again.");
        autoRef.current = false;
      } finally {
        setVerifying(false);
      }
    },
    [email, verifying, verified, router]
  );

  // Auto-submit once all six digits are in (re-arms if the code is cleared).
  useEffect(() => {
    if (code.length < CODE_LENGTH) {
      autoRef.current = false;
      return;
    }
    if (!autoRef.current && !verifying && !verified) {
      autoRef.current = true;
      void submitCode(code);
    }
  }, [code, submitCode, verifying, verified]);

  function setDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, "");
    setDigits((prev) => {
      const next = [...prev];
      if (clean.length > 1) {
        // Multi-digit input (autofill / stray paste): fill forward.
        for (
          let i = 0;
          i < clean.length && index + i < CODE_LENGTH;
          i++
        ) {
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

  async function handleResend(e?: FormEvent) {
    e?.preventDefault();
    if (cooldown > 0 || resending || !email) return;
    setResending(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/auth/resend-code", {
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
          "If an account with that email needs verification, a new code has been sent."
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

  if (!email) {
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
          <h1 className="text-xl font-bold">Verification code required</h1>
          <p className="text-gray-600 text-sm">
            We couldn&apos;t find the email for this verification. Please
            create your account again.
          </p>
          <Link href="/register" className="inline-block w-full btn-primary">
            Back to sign up
          </Link>
        </div>
      </div>
    );
  }

  if (verified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-green-50 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center space-y-4">
          <div className="flex items-center justify-center">
            <CheckCircle2 size={56} className="text-[#25D366]" />
          </div>
          <h1 className="text-2xl font-bold">Email verified!</h1>
          <p className="text-gray-600 text-sm">
            Your account is active. Taking you to sign in&hellip;
          </p>
          <Link
            href="/login?verified=1"
            className="inline-block w-full btn-primary"
          >
            Continue to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-green-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Logo + heading */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element -- local PNG logo */}
            <img
              src="/assets/sellup-logo.png"
              alt="Sell Up"
              className="h-9 w-auto"
            />
          </div>
          <h1 className="text-3xl font-bold mb-2">Verify Your Email</h1>
          <p className="text-gray-600 text-sm">
            Enter the 6-digit code we sent to
            <br />
            <span className="font-semibold text-gray-900 break-all">
              {email}
            </span>
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

          {/* Code boxes */}
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
                disabled={verifying || verified}
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
            disabled={code.length !== CODE_LENGTH || verifying || verified}
            className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {verifying ? "Verifying..." : "Verify Email"}{" "}
            <ArrowRight size={20} />
          </button>

          {/* Resend */}
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
        </div>

        {/* Back links */}
        <p className="text-center text-gray-600 mt-6 text-sm">
          Wrong email?{" "}
          <Link
            href="/register"
            className="text-[#25D366] font-semibold hover:underline"
          >
            Use a different address
          </Link>
        </p>
        <div className="text-center mt-8">
          <Link
            href="/"
            className="text-gray-600 hover:text-gray-900 text-sm font-medium"
          >
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-green-50" />
      }
    >
      <VerifyForm />
    </Suspense>
  );
}
