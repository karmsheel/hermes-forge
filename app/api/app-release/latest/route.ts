import { NextResponse } from "next/server";
import { APP_RELEASES_URL } from "@/lib/app-meta";

const GITHUB_LATEST_RELEASE_URL =
  "https://api.github.com/repos/karmsheel/hermes-forge/releases/latest";

export async function GET() {
  try {
    const res = await fetch(GITHUB_LATEST_RELEASE_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Hermes-Forge",
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch the latest release from GitHub." },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      tag_name?: string;
      name?: string;
      body?: string | null;
      published_at?: string | null;
      html_url?: string;
    };

    const version = data.tag_name?.replace(/^v/i, "") ?? "";
    if (!version) {
      return NextResponse.json({ error: "Latest release is missing a version tag." }, { status: 502 });
    }

    return NextResponse.json({
      version,
      name: data.name ?? `Hermes Forge ${version}`,
      body: data.body ?? null,
      publishedAt: data.published_at ?? null,
      url: data.html_url ?? APP_RELEASES_URL,
    });
  } catch (error) {
    console.error("[app-release/latest]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load release information." },
      { status: 500 }
    );
  }
}