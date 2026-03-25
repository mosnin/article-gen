"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";

interface InvitedUser {
  id: string;
  email: string;
  role: "member" | "admin";
  status: "pending" | "accepted";
  invitedAt: string;
}

export default function TeamPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      const { data } = await supabase
        .from("user_settings")
        .select("team_invites")
        .eq("user_id", user.id)
        .single();

      if (data?.team_invites) {
        setInvitedUsers(data.team_invites as InvitedUser[]);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInvite = async () => {
    if (!email.trim() || !email.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    if (invitedUsers.some((u) => u.email === email.trim())) {
      toast.error("This user has already been invited");
      return;
    }

    setInviting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newInvite: InvitedUser = {
        id: crypto.randomUUID(),
        email: email.trim(),
        role: "member",
        status: "pending",
        invitedAt: new Date().toISOString(),
      };
      const updated = [...invitedUsers, newInvite];
      setInvitedUsers(updated);

      await supabase.from("user_settings").upsert(
        { user_id: user.id, team_invites: updated },
        { onConflict: "user_id" }
      );

      setEmail("");
      toast.success(`Invitation sent to ${newInvite.email}`);
    } catch {
      toast.error("Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const updated = invitedUsers.filter((u) => u.id !== id);
    setInvitedUsers(updated);
    await supabase.from("user_settings").upsert(
      { user_id: user.id, team_invites: updated },
      { onConflict: "user_id" }
    );
    toast.success("User removed");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Invite card */}
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] p-6">
        <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">
          Invite users to your organization
        </h2>

        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleInvite()}
            placeholder="email@gmail.com"
            className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
          />
          <Button onClick={handleInvite} loading={inviting} className="shrink-0">
            Invite
          </Button>
        </div>

        {/* Invited users list */}
        <div className="mt-5">
          <p className="mb-3 text-xs font-semibold text-[var(--text-secondary)]">Invited Users</p>

          {invitedUsers.length === 0 ? (
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] px-4 py-6 text-center">
              <p className="text-sm text-[var(--text-tertiary)]">No invited users just yet</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-default)] rounded-lg border border-[var(--border-default)]">
              {invitedUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-light)] text-sm font-semibold text-[var(--accent)]">
                      {u.email[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{u.email}</p>
                      <p className="text-xs text-[var(--text-tertiary)] capitalize">{u.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      u.status === "accepted"
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {u.status === "accepted" ? "Accepted" : "Pending"}
                    </span>
                    <button
                      onClick={() => handleRemove(u.id)}
                      className="text-[var(--text-tertiary)] hover:text-[var(--error)] transition-colors"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-sunken)] p-4">
        <div className="flex items-start gap-3">
          <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <p className="text-xs text-[var(--text-secondary)]">
            Invited members can view and manage articles within your organization. Admins can also manage settings and integrations.
            Team collaboration requires a paid plan.
          </p>
        </div>
      </div>
    </div>
  );
}
