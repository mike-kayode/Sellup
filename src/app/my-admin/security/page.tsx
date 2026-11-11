"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AlertTriangle, CheckCircle2, Lock, Shield, XCircle } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface SecurityEvent {
  id: string;
  action: string;
  actorName: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AdminSession {
  id: string;
  userId: string;
  email: string;
  role: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastSeenAt: string;
  expiresAt: string;
  createdAt: string;
  isCurrent: boolean;
}

interface SecurityData {
  requireStaffMfa: boolean;
  role: string;
  mfaEnrollmentOnly: boolean;
  events: SecurityEvent[];
  sessions: AdminSession[];
  total: number;
}

interface PendingFactor {
  id: string;
  qrCode: string;
  secret: string;
}

interface VerifiedFactor {
  id: string;
  friendlyName: string | null;
  factorType: string;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export default function AdminSecurityPage() {
  const router = useRouter();
  const [data, setData] = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [verifiedFactorCount, setVerifiedFactorCount] = useState(0);
  const [verifiedFactors, setVerifiedFactors] = useState<VerifiedFactor[]>([]);
  const [stepUpCode, setStepUpCode] = useState("");
  const [currentAal, setCurrentAal] = useState<string | null>(null);
  const [pendingFactor, setPendingFactor] = useState<PendingFactor | null>(null);
  const [verificationCode, setVerificationCode] = useState("");

  const loadSecurityData = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const [{ data: sessionData }, { data: assurance }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setError("Your session has expired. Sign in again to continue.");
        return;
      }

      setError("");
      setCurrentAal(assurance?.currentLevel ?? null);
      const [securityResponse, factorResponse] = await Promise.all([
        fetch("/api/admin/security", { headers: { Authorization: "Bearer " + accessToken } }),
        supabase.auth.mfa.listFactors(),
      ]);
      const result = await securityResponse.json();
      if (!securityResponse.ok) {
        throw new Error(result.error || "Failed to load security data");
      }
      if (factorResponse.error) throw factorResponse.error;
      const verified = factorResponse.data.all
        .filter((factor) => factor.status === "verified")
        .map((factor) => ({
          id: factor.id,
          friendlyName: factor.friendly_name ?? null,
          factorType: factor.factor_type,
        }));
      setVerifiedFactors(verified);
      setVerifiedFactorCount(verified.length);
      setIsSuperadmin(result.role === "superadmin");
      setData(result as SecurityData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load security data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load server data once the authenticated client is ready.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSecurityData();
  }, [loadSecurityData]);

  async function getAccessToken(): Promise<string> {
    const { data: sessionData } = await getSupabaseClient().auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Your session has expired. Sign in again to continue.");
    return token;
  }

  async function startEnrollment() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data: factor, error: enrollError } = await getSupabaseClient().auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "SellUp admin authenticator",
        issuer: "SellUp",
      });
      if (enrollError) throw enrollError;
      setPendingFactor({ id: factor.id, qrCode: factor.totp.qr_code, secret: factor.totp.secret });
      setNotice("Scan the QR code with an authenticator app, then enter its current six-digit code.");
    } catch (enrollError) {
      setError(enrollError instanceof Error ? enrollError.message : "Could not start authenticator enrollment");
    } finally {
      setBusy(false);
    }
  }

  async function verifyEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingFactor || !/^\d{6}$/.test(verificationCode)) {
      setError("Enter the six-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { error: verifyError } = await getSupabaseClient().auth.mfa.challengeAndVerify({
        factorId: pendingFactor.id,
        code: verificationCode,
      });
      if (verifyError) throw verifyError;
      setPendingFactor(null);
      setVerificationCode("");
      setNotice("Authenticator verified. Your admin session now uses multi-factor authentication.");
      await loadSecurityData();
      router.replace("/my-admin");
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Authenticator verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function verifyExistingFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const factor = verifiedFactors.find((candidate) => candidate.factorType === "totp");
    if (!factor || !/^\d{6}$/.test(stepUpCode)) {
      setError("Enter the six-digit code from your verified authenticator.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error: verifyError } = await getSupabaseClient().auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code: stepUpCode,
      });
      if (verifyError) throw verifyError;
      setNotice("Multi-factor authentication verified.");
      await loadSecurityData();
      router.replace("/my-admin");
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Authenticator verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnrollment() {
    if (!pendingFactor) return;
    setBusy(true);
    setError("");
    try {
      const { error: unenrollError } = await getSupabaseClient().auth.mfa.unenroll({ factorId: pendingFactor.id });
      if (unenrollError) throw unenrollError;
      setPendingFactor(null);
      setVerificationCode("");
    } catch (unenrollError) {
      setError(unenrollError instanceof Error ? unenrollError.message : "Could not cancel authenticator enrollment");
    } finally {
      setBusy(false);
    }
  }

  async function updateMfaRequirement(enabled: boolean) {
    if (enabled && !window.confirm("Require every active staff member to have a verified authenticator before allowing admin access?")) {
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/admin/security", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "require_staff_mfa", enabled }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update MFA enforcement");
      setNotice(enabled ? "Staff MFA enforcement is enabled." : "Staff MFA enforcement is disabled.");
      await loadSecurityData();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update MFA enforcement");
    } finally {
      setBusy(false);
    }
  }

  async function revokeSession(session: AdminSession) {
    if (session.isCurrent || !window.confirm(`Revoke the admin session for ${session.email}?`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/admin/security", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke_session", sessionRecordId: session.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not revoke session");
      setNotice(`Session for ${session.email} was revoked.`);
      await loadSecurityData();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Could not revoke session");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) {
    return <div className="animate-pulse space-y-4" aria-label="Loading security center">
      <div className="h-8 w-56 rounded bg-slate-200" />
      <div className="h-28 rounded-xl bg-slate-200" />
      <div className="h-64 rounded-xl bg-slate-200" />
    </div>;
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800" role="alert">
        <p>{error}</p>
        <button className="mt-4 rounded-lg border border-red-300 px-4 py-2 font-semibold" onClick={() => { setLoading(true); void loadSecurityData(); }}>
          Retry
        </button>
      </div>
    );
  }

  const events = data?.events || [];
  const activeSessions = data?.sessions || [];
  const mustEnroll = Boolean(data?.mfaEnrollmentOnly || (data?.requireStaffMfa && currentAal !== "aal2"));
  const failedLogins = events.filter((event) => event.action.includes("login_failed") || event.action.includes("login_rate_limited")).length;
  const lockedAccounts = events.filter((event) => event.action === "account_locked").length;
  const suspiciousActivity = events.filter((event) => event.action === "suspicious_activity").length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Security Center</h1>
        <p className="mt-2 text-gray-600">Manage staff authentication, active sessions, and access events.</p>
      </header>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">{notice}</div>}

      {mustEnroll && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6" aria-labelledby="mfa-required-title">
          <div className="flex items-start gap-3">
            <Shield className="mt-1 shrink-0 text-amber-700" />
            <div>
              <h2 id="mfa-required-title" className="text-lg font-bold text-amber-950">Set up staff multi-factor authentication</h2>
              <p className="mt-1 text-sm text-amber-900">
                Admin access is limited until you verify an authenticator factor. Your security events and sessions remain hidden during setup.
              </p>
            </div>
          </div>
        </section>
      )}

      {mustEnroll && verifiedFactors.some((factor) => factor.factorType === "totp") && (
        <form onSubmit={(event) => void verifyExistingFactor(event)} className="rounded-xl border border-slate-200 bg-white p-6">
          <label className="block max-w-sm">
            <span className="mb-2 block font-semibold text-slate-800">Verify your existing authenticator</span>
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]{6}"
              value={stepUpCode}
              onChange={(event) => setStepUpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono tracking-widest"
              aria-label="Existing authenticator verification code"
              required
            />
          </label>
          <button disabled={busy} className="mt-4 rounded-lg bg-green-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
            Verify and continue
          </button>
        </form>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6" aria-labelledby="authenticator-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="authenticator-title" className="text-lg font-bold text-slate-900">Authenticator</h2>
            <p className="mt-1 text-sm text-slate-600">
              {verifiedFactorCount
                ? `${verifiedFactorCount} verified factor${verifiedFactorCount === 1 ? "" : "s"} on this account.`
                : "No verified authenticator factor is set up on this account."}
            </p>
          </div>
          {!pendingFactor && (
            (verifiedFactorCount === 0 || (mustEnroll && !verifiedFactors.some((factor) => factor.factorType === "totp"))) && (
            <button disabled={busy} onClick={() => void startEnrollment()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Set up authenticator
            </button>
            )
          )}
        </div>

        {pendingFactor && (
          <div className="mt-5 grid gap-6 border-t border-slate-100 pt-5 md:grid-cols-[200px_1fr]">
            <Image className="h-48 w-48 rounded border border-slate-200 bg-white p-2" src={`data:image/svg+xml;utf8,${encodeURIComponent(pendingFactor.qrCode)}`} alt="Authenticator enrollment QR code" width={192} height={192} unoptimized />
            <div className="space-y-4">
              <p className="text-sm text-slate-700">If you cannot scan the QR code, enter this secret manually:</p>
              <code className="block break-all rounded bg-slate-100 p-3 font-mono text-sm">{pendingFactor.secret}</code>
              <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => void verifyEnrollment(event)}>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Six-digit code</span>
                  <input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-40 rounded-lg border border-slate-300 px-3 py-2 font-mono tracking-widest"
                    aria-label="Authenticator verification code"
                    required
                  />
                </label>
                <button disabled={busy} className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
                  Verify and enable
                </button>
                <button type="button" disabled={busy} onClick={() => void cancelEnrollment()} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 disabled:opacity-50">
                  Cancel
                </button>
              </form>
            </div>
          </div>
        )}
      </section>

      {isSuperadmin && !mustEnroll && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6">
          <div>
            <h2 className="font-bold text-slate-900">Require MFA for all active staff</h2>
            <p className="mt-1 text-sm text-slate-600">Enabling checks every active staff account for a verified factor first.</p>
          </div>
          <button
            disabled={busy || (!data?.requireStaffMfa && verifiedFactorCount === 0)}
            onClick={() => void updateMfaRequirement(!data?.requireStaffMfa)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${data?.requireStaffMfa ? "bg-amber-700" : "bg-slate-900"}`}
          >
            {data?.requireStaffMfa ? "Disable enforcement" : "Enable enforcement"}
          </button>
        </section>
      )}

      {!mustEnroll && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Failed login events", value: failedLogins, icon: AlertTriangle, color: "text-red-600 bg-red-50" },
              { label: "Locked accounts", value: lockedAccounts, icon: Lock, color: "text-yellow-700 bg-yellow-50" },
              { label: "Suspicious activity", value: suspiciousActivity, icon: Shield, color: "text-orange-700 bg-orange-50" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-3 ${color}`}><Icon size={22} /></div>
                  <div><p className="text-sm text-slate-600">{label}</p><p className="text-2xl font-bold text-slate-900">{value}</p></div>
                </div>
              </div>
            ))}
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-bold text-slate-900">Active admin sessions</h2>
              <p className="text-sm text-slate-600">Showing up to 100 unexpired sessions. Revocation takes effect on the next admin request.</p>
            </div>
            {activeSessions.length === 0 ? (
              <div className="p-10 text-center text-slate-500">No active admin sessions recorded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr><th className="px-5 py-3">Staff</th><th className="px-5 py-3">IP / browser</th><th className="px-5 py-3">Last seen</th><th className="px-5 py-3">Expires</th><th className="px-5 py-3">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeSessions.map((session) => (
                      <tr key={session.id}>
                        <td className="px-5 py-4"><span className="font-medium text-slate-900">{session.email}</span><span className="block text-xs capitalize text-slate-500">{session.role}{session.isCurrent ? " · current session" : ""}</span></td>
                        <td className="max-w-xs px-5 py-4 text-slate-600"><span className="block font-mono">{session.ipAddress || "Unknown IP"}</span><span className="block truncate text-xs">{session.userAgent || "Unknown browser"}</span></td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatDate(session.lastSeenAt)}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatDate(session.expiresAt)}</td>
                        <td className="px-5 py-4">
                          <button
                            disabled={busy || session.isCurrent}
                            onClick={() => void revokeSession(session)}
                            className="inline-flex items-center gap-1 rounded border border-red-200 px-3 py-1.5 font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Revoke session for ${session.email}`}
                          >
                            <XCircle size={15} /> Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div><h2 className="font-bold text-slate-900">Recent security events</h2><p className="text-sm text-slate-600">{data?.total || 0} matching events</p></div>
              <button onClick={() => { setLoading(true); void loadSecurityData(); }} disabled={loading} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Refresh</button>
            </div>
            {events.length === 0 ? (
              <div className="p-10 text-center text-slate-500">No security events recorded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-3">Action</th><th className="px-5 py-3">Actor</th><th className="px-5 py-3">IP address</th><th className="px-5 py-3">Date</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {events.map((event) => <tr key={event.id}>
                      <td className="px-5 py-4"><span className="inline-flex items-center gap-2 capitalize text-slate-800">{event.action.includes("failed") ? <AlertTriangle size={15} className="text-red-600" /> : <CheckCircle2 size={15} className="text-slate-400" />}{event.action.replace(/_/g, " ")}</span></td>
                      <td className="px-5 py-4 text-slate-700">{event.actorName}</td>
                      <td className="px-5 py-4 font-mono text-slate-600">{event.ipAddress || "—"}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatDate(event.createdAt)}</td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
