"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import AppShell from "@/components/app-shell";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [changingPassword, setChangingPassword] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadUser = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/?auth=login");
      return;
    }

    setEmail(user.email || "");
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!email) {
      setMessage({ type: "error", text: "Could not verify your account email." });
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: "error", text: "Please fill in all password fields." });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New password and confirm password do not match." });
      return;
    }

    setChangingPassword(true);

    const verify = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (verify.error) {
      setChangingPassword(false);
      setMessage({ type: "error", text: "Current password is incorrect." });
      return;
    }

    const update = await supabase.auth.updateUser({ password: newPassword });

    if (update.error) {
      setMessage({ type: "error", text: update.error.message || "Unable to update password." });
    } else {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage({ type: "success", text: "Password updated successfully." });
    }

    setChangingPassword(false);
  };

  const handleSendPasswordReset = async () => {
    setMessage(null);

    if (!email) {
      setMessage({ type: "error", text: "Could not verify your account email." });
      return;
    }

    setSendingReset(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/?auth=reset`,
    });

    if (error) {
      setMessage({ type: "error", text: error.message || "Unable to send reset email." });
    } else {
      setMessage({ type: "success", text: "Password reset email sent. Check your inbox." });
    }

    setSendingReset(false);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "var(--background)" }}>
        <svg className="progress-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
      </div>
    );
  }

  return (
    <AppShell title="Settings" onSignOut={handleLogout}>
      <section className="mb-8 rounded-xl border p-5 md:p-6" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}>
        <h2 className="text-xl font-bold">Account</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>Manage your login credentials and password.</p>

        <div className="mt-5 rounded-lg border p-4" style={{ borderColor: "var(--card-border)", background: "var(--background)" }}>
          <div className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Email</div>
          <div className="mt-1 text-sm font-medium break-all">{email}</div>
        </div>
      </section>

      <section className="mb-8 rounded-xl border p-5 md:p-6" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}>
        <h2 className="text-xl font-bold">Change Password</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>For security, confirm your current password before setting a new one.</p>

        <form className="mt-5 grid gap-4" onSubmit={handleChangePassword}>
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--card-border)", background: "var(--background)" }}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--card-border)", background: "var(--background)" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--card-border)", background: "var(--background)" }}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={changingPassword}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ background: "var(--accent)", opacity: changingPassword ? 0.7 : 1 }}
            >
              {changingPassword ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border p-5 md:p-6" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}>
        <h2 className="text-xl font-bold">Reset Password by Email</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>If you forgot your password, request a reset link.</p>

        <button
          onClick={handleSendPasswordReset}
          disabled={sendingReset}
          className="mt-4 rounded-lg border px-4 py-2 text-sm font-semibold"
          style={{ borderColor: "var(--card-border)", background: "var(--background)", opacity: sendingReset ? 0.7 : 1 }}
        >
          {sendingReset ? "Sending..." : "Send Password Reset Email"}
        </button>
      </section>

      {message && (
        <div className="mt-6 rounded-lg border px-4 py-3 text-sm font-medium" style={{
          borderColor: message.type === "success" ? "#86efac" : "#fca5a5",
          background: message.type === "success" ? "#f0fdf4" : "#fef2f2",
          color: message.type === "success" ? "#166534" : "#991b1b",
        }}>
          {message.text}
        </div>
      )}
    </AppShell>
  );
}
