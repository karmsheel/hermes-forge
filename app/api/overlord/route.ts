import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { scanHermesProfiles } from "@/lib/personnel/scan-hermes-profiles";
import {
  getUserOverlord,
  setUserOverlord,
} from "@/lib/overlord/user-overlord";
import type { ScannedOverlordCandidate } from "@/lib/overlord/types";

function toCandidates(): ScannedOverlordCandidate[] {
  return scanHermesProfiles().map((p) => ({
    profileKey: p.profileKey,
    displayName: p.displayName,
    description: p.description,
    model: p.model,
    hermesHome: p.hermesHome,
    isDefault: p.isDefault,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;
    const overlord = await getUserOverlord(session.userId);
    return NextResponse.json({ overlord, candidates: toCandidates() });
  } catch (e) {
    console.error("GET overlord", e);
    return NextResponse.json({ error: "Failed to load Overlord" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;
    const body = await request.json().catch(() => ({}));
    const profileKey = typeof body.profileKey === "string" ? body.profileKey.trim() : "";
    if (!profileKey) {
      return NextResponse.json({ error: "profileKey is required" }, { status: 400 });
    }
    const candidate = toCandidates().find((c) => c.profileKey === profileKey);
    if (!candidate) {
      return NextResponse.json(
        { error: "Profile not found. Rescan Hermes or spawn a new profile." },
        { status: 404 },
      );
    }
    // Optional client snapshots (e.g. spawn displayName) override scan when provided.
    const displayName =
      typeof body.displayName === "string" && body.displayName.trim()
        ? body.displayName.trim()
        : candidate.displayName;
    const hermesHome =
      typeof body.hermesHome === "string" && body.hermesHome.trim()
        ? body.hermesHome.trim()
        : candidate.hermesHome;
    const overlord = await setUserOverlord(session.userId, {
      ...candidate,
      displayName,
      hermesHome,
    });
    return NextResponse.json({ overlord });
  } catch (e) {
    console.error("PUT overlord", e);
    return NextResponse.json({ error: "Failed to set Overlord" }, { status: 500 });
  }
}
