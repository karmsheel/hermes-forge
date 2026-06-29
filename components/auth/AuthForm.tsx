"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AuthFormProps {
  mode: "login" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const isSignup = mode === "signup";
  const redirectTo = searchParams.get("from") || "/projects";

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
      router.push(redirectTo);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center">
              <span className="text-black font-bold">H</span>
            </div>
            <span className="font-semibold text-lg">Hermes Forge</span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isSignup ? "Create your account" : "Sign in"}
          </h1>
          <p className="text-sm text-zinc-500 mt-2">
            {isSignup
              ? "Create an account — add your project details as you chat"
              : "Access your projects and process workshops"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {isSignup && (
            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-widest">Name</label>
              <input
                className="input w-full mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-widest">Email</label>
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
            <label className="text-xs text-zinc-500 uppercase tracking-widest">Password</label>
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

        <p className="text-center text-sm text-zinc-500 mt-6">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <Link href="/login" className="text-white hover:underline">
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