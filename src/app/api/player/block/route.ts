import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {ensurePlayerRow, getBearerToken, getOrCreatePlayer} from "@/lib/server/interchat-auth";

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

  const body = (await request.json().catch(() => null)) as {targetUuid?: string} | null;
  const targetUuid = body?.targetUuid ?? "";
  if (!targetUuid) {
    return NextResponse.json({error: "Missing targetUuid"}, {status: 400});
  }

  await env.interchat
    .prepare("INSERT OR IGNORE INTO blocked_users (id, blocked_uuid) VALUES (?, ?)")
    .bind(player.uuid, targetUuid)
    .run();

  return NextResponse.json({ok: true});
}

export async function DELETE(request: Request) {
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

  const {searchParams} = new URL(request.url);
  const targetUuid = searchParams.get("targetUuid") ?? "";
  if (!targetUuid) {
    return NextResponse.json({error: "Missing targetUuid"}, {status: 400});
  }

  await env.interchat
    .prepare("DELETE FROM blocked_users WHERE id = ? AND blocked_uuid = ?")
    .bind(player.uuid, targetUuid)
    .run();

  return NextResponse.json({ok: true});
}
