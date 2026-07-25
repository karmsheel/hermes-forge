import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessForUser, requireSession } from "@/lib/auth";
import {
  type GraphPatch,
  type GraphPatchOp,
  isGraphEdgeKind,
  isGraphNodeKind,
} from "@/lib/business-graph";
import {
  applyAndSaveGraphPatch,
  ensureBusinessGraphSeeded,
  reseedBusinessGraph,
} from "@/lib/business-graph/repository";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ graph: null, business: null, seeded: false });
    }

    const reseed = request.nextUrl.searchParams.get("reseed") === "1";
    if (reseed) {
      const graph = await reseedBusinessGraph(business.id);
      return NextResponse.json({
        graph,
        business: { id: business.id, name: business.name },
        seeded: true,
      });
    }

    const { graph, seeded } = await ensureBusinessGraphSeeded(business.id);
    return NextResponse.json({
      graph,
      business: { id: business.id, name: business.name },
      seeded,
    });
  } catch (error) {
    console.error("business-graph GET", error);
    return NextResponse.json(
      { error: "Failed to load business graph" },
      { status: 500 },
    );
  }
}

function parseOps(body: unknown): GraphPatchOp[] | null {
  if (!body || typeof body !== "object") return null;
  const ops = (body as { ops?: unknown }).ops;
  if (!Array.isArray(ops)) return null;
  const out: GraphPatchOp[] = [];
  for (const raw of ops) {
    if (!raw || typeof raw !== "object") continue;
    const op = (raw as { op?: string }).op;
    if (op === "upsert_node") {
      const node = (raw as { node?: unknown }).node;
      if (!node || typeof node !== "object") continue;
      const n = node as Record<string, unknown>;
      if (typeof n.id !== "string" || typeof n.name !== "string") continue;
      if (!isGraphNodeKind(n.kind)) continue;
      out.push({
        op: "upsert_node",
        node: {
          id: n.id,
          kind: n.kind,
          name: n.name,
          parentId:
            n.parentId === null || n.parentId === undefined
              ? null
              : typeof n.parentId === "string"
                ? n.parentId
                : null,
          description:
            typeof n.description === "string" ? n.description : null,
          props:
            n.props && typeof n.props === "object"
              ? (n.props as Record<string, unknown>)
              : undefined,
          position:
            n.position &&
            typeof n.position === "object" &&
            typeof (n.position as { x?: unknown }).x === "number" &&
            typeof (n.position as { y?: unknown }).y === "number"
              ? {
                  x: (n.position as { x: number }).x,
                  y: (n.position as { y: number }).y,
                }
              : null,
        },
      });
    } else if (op === "delete_node" && typeof (raw as { id?: unknown }).id === "string") {
      out.push({ op: "delete_node", id: (raw as { id: string }).id });
    } else if (op === "upsert_edge") {
      const edge = (raw as { edge?: unknown }).edge;
      if (!edge || typeof edge !== "object") continue;
      const e = edge as Record<string, unknown>;
      if (
        typeof e.id !== "string" ||
        typeof e.fromId !== "string" ||
        typeof e.toId !== "string" ||
        !isGraphEdgeKind(e.kind)
      ) {
        continue;
      }
      out.push({
        op: "upsert_edge",
        edge: {
          id: e.id,
          kind: e.kind,
          fromId: e.fromId,
          toId: e.toId,
          label: typeof e.label === "string" ? e.label : null,
        },
      });
    } else if (op === "delete_edge" && typeof (raw as { id?: unknown }).id === "string") {
      out.push({ op: "delete_edge", id: (raw as { id: string }).id });
    } else if (op === "set_position") {
      const id = (raw as { id?: unknown }).id;
      const position = (raw as { position?: unknown }).position;
      if (typeof id !== "string" || !position || typeof position !== "object") {
        continue;
      }
      const x = (position as { x?: unknown }).x;
      const y = (position as { y?: unknown }).y;
      if (typeof x !== "number" || typeof y !== "number") continue;
      out.push({ op: "set_position", id, position: { x, y } });
    }
  }
  return out;
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json(
        { error: "No active business" },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => null);
    const ops = parseOps(body);
    if (!ops || ops.length === 0) {
      return NextResponse.json(
        { error: "Body must include ops[]" },
        { status: 400 },
      );
    }

    await ensureBusinessGraphSeeded(business.id);
    const patch: GraphPatch = { ops };
    const result = await applyAndSaveGraphPatch(business.id, patch);

    return NextResponse.json({
      graph: result.graph,
      applied: result.applied,
      errors: result.errors,
      business: { id: business.id, name: business.name },
    });
  } catch (error) {
    console.error("business-graph PATCH", error);
    return NextResponse.json(
      { error: "Failed to patch business graph" },
      { status: 500 },
    );
  }
}
