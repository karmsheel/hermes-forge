import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { spawnHermesProfile, SpawnProfileError } from "@/lib/overlord/spawn-profile";
import { setUserOverlord } from "@/lib/overlord/user-overlord";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;
    const body = await request.json().catch(() => ({}));
    const displayName = typeof body.displayName === "string" ? body.displayName : "";
    const description =
      typeof body.description === "string" ? body.description : null;
    const setAsOverlord = body.setAsOverlord !== false;

    const candidate = spawnHermesProfile({ displayName, description });
    let overlord = null;
    if (setAsOverlord) {
      overlord = await setUserOverlord(session.userId, candidate);
    }
    return NextResponse.json({ candidate, overlord }, { status: 201 });
  } catch (e) {
    if (e instanceof SpawnProfileError) {
      const status = e.code === "collision" ? 409 : e.code === "invalid" ? 400 : 500;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    console.error("POST overlord/spawn", e);
    return NextResponse.json({ error: "Failed to spawn profile" }, { status: 500 });
  }
}
