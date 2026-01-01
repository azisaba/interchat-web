import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {ensurePlayerRow, getBearerToken, getOrCreatePlayer} from "@/lib/server/interchat-auth";
import {parseDurationString} from "@/lib/server/duration";

const DISABLE_WORDS = new Set(["off", "disable", "disabled", "no"]);
const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const {env} = getCloudflareContext();
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }
  const player = await getOrCreatePlayer(env, token);
  if (!player) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }
  await ensurePlayerRow(env, player);

  const body = (await request.json().catch(() => null)) as {duration?: string} | null;
  const arg = body?.duration?.trim() ?? "";

  let durationMs: number;
  if (!arg) {
    const current = await env.interchat
      .prepare("SELECT hide_all_until FROM players WHERE id = ?")
      .bind(player.uuid)
      .all<{hide_all_until: number}>();
    const currentUntil = current.results?.[0]?.hide_all_until ?? 0;
    if (currentUntil < Date.now()) {
      durationMs = 30 * 60 * 1000;
    } else {
      durationMs = 0;
    }
  } else if (DISABLE_WORDS.has(arg.toLowerCase())) {
    durationMs = 0;
  } else {
    const parsed = parseDurationString(arg);
    if (parsed === null) {
      return NextResponse.json({error: "Invalid duration"}, {status: 400});
    }
    durationMs = parsed;
  }

  if (durationMs < 0 || durationMs > MAX_DURATION_MS) {
    return NextResponse.json({error: "Invalid duration"}, {status: 400});
  }

  const hideUntil = Date.now() + durationMs;
  await env.interchat
    .prepare("UPDATE players SET hide_all_until = ? WHERE id = ?")
    .bind(hideUntil, player.uuid)
    .run();

  return NextResponse.json({ok: true, hide_until: hideUntil, duration_ms: durationMs});
}
