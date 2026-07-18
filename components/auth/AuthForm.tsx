"use client";

import Image from "next/image";
import Link from "next/link";
import iconImage from "@/assets/icon.jpg";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AuthFormProps {
  mode: "login" | "signup";
  welcome?: boolean;
}

export function AuthForm({ mode, welcome = false }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const isSignup = mode === "signup";
  const redirectTo = searchParams.get("from") || "/business-manager";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ...(isSignup && { name: name.trim() || undefined }),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data.error ||
          (res.status === 409 ? "An account with this email already exists" : "Authentication failed");
        throw new Error(msg);
      }

      toast.success(isSignup ? "Account created" : "Welcome back");
      // Snappy first-run: skip BM bounce when Overlord is not set yet
      const me = await fetch("/api/overlord")
        .then((r) => r.json())
        .catch(() => null);
      router.push(me?.overlord?.profileKey ? redirectTo : "/setup/overlord");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Image
              src={iconImage}
              alt="Hermes Forge"
              className="w-9 h-9 rounded-lg object-cover"
              width={36}
              height={36}
              priority
            />
            <span className="font-semibold text-lg">Hermes Forge</span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isSignup ? "Create your account" : welcome ? "Welcome to Hermes Forge" : "Sign in"}
          </h1>
          <p className="text-sm text-text-muted mt-2">
            {isSignup
              ? "Create an account — add your business details as you chat"
              : welcome
                ? "Sign in or create an account to start mapping your business processes"
                : "Access your businesses and process workshops"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {isSignup && (
            <div>
              <label className="text-xs text-text-muted uppercase tracking-widest">Name</label>
              <input
                className="input w-full mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-text-muted uppercase tracking-widest">Email</label>
            <input
              className="input w-full mt-1"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="text-xs text-text-muted uppercase tracking-widest">Password</label>
            <input
              className="input w-full mt-1"
              type="password"
              required
              minLength={isSignup ? 8 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignup ? "Min. 8 characters" : "Your password"}
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-text-muted mt-6">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <Link href="/" className="text-white hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              No account yet?{" "}
              <Link href="/signup" className="text-white hover:underline">
                Create one
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}