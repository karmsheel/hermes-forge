"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, LogOut } from "lucide-react";
import { SignInOptions } from "@/components/auth/SignInOptions";
import { useShell } from "@/components/shell/ShellContext";
import { isLocalUserEmail } from "@/lib/local-user-email";
import type { UserProfile } from "@/lib/types";

/**
 * Slim profile body — display name + sign-in methods only.
 * Business management lives on Business Manager.
 */
export function ProfileContent() {
  const router = useRouter();
  const { closeProfile } = useShell();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setUser(data.user);
        setName(data.user?.name || "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null }),
      });
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json();
      setUser(updated);
      toast.success("Profile updated");
    } catch {
      toast.error("Could not update profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Logout failed");
      toast.success("Signed out");
      closeProfile();
      router.push("/sign-in");
      router.refresh();
    } catch {
      toast.error("Could not sign out");
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="profile-overlay__body profile-overlay__body--loading">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  const authLabel = isLocalUserEmail(user?.email)
    ? "Local mode (no account)"
    : user?.email || "Signed in";

  const overlordLabel =
    user?.forgeOverlordDisplayName?.trim() ||
    user?.forgeOverlordProfileKey?.trim() ||
    "Not set";

  return (
    <div className="profile-overlay__body">
      <header className="profile-overlay__header">
        <div className="text-xs uppercase tracking-widest text-text-muted">Account</div>
        <h2 className="text-lg font-semibold tracking-tight mt-1">Profile</h2>
        <p className="text-xs text-text-soft mt-1 truncate" title={authLabel}>
          {authLabel}
        </p>
      </header>

      <form onSubmit={handleSave} className="card p-4 space-y-3 mb-4">
        <div>
          <label className="text-[10px] text-text-muted uppercase tracking-widest">
            Display name
          </label>
          <input
            className="input w-full mt-1 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your display name"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={saving} className="btn-primary text-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="btn-secondary text-sm"
          >
            {loggingOut ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <LogOut className="w-4 h-4" />
                Log out
              </>
            )}
          </button>
        </div>
      </form>

      <div className="card p-4 space-y-2 mb-4">
        <div className="text-[10px] text-text-muted uppercase tracking-widest">
          Forge Overlord
        </div>
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-sm truncate min-w-0"
            title={
              user?.forgeOverlordDisplayName?.trim() ||
              user?.forgeOverlordProfileKey ||
              undefined
            }
          >
            {overlordLabel}
          </span>
          <button
            type="button"
            className="btn-secondary text-sm shrink-0"
            onClick={() => {
              router.push("/setup/overlord?change=1");
              closeProfile();
            }}
          >
            Change
          </button>
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1.5">
          Sign-in
        </div>
        <p className="text-xs text-text-muted mb-2">
          Stay local, or add email / GitHub later.
        </p>
        <SignInOptions
          variant="profile"
          currentEmail={user?.email}
          redirectTo="/profile"
          showBrand={false}
        />
      </div>
    </div>
  );
}
