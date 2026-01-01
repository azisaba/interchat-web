import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {ensurePlayerRow, getBearerToken, getMemberRole, getOrCreatePlayer} from "@/lib/server/interchat-auth";
import {submitGuildLog} from "@/lib/server/guild-db";

export async function POST(request: Request, context: { params: Promise<{id: string}> }) {
  const {env} = getCloudflareContext();
  const {id} = await context.params;
  const guildId = Number(id);
  if (!Number.isFinite(guildId)) {
    return NextResponse.json({error: "Invalid guild id"}, {status: 400});
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }
  const actor = await getOrCreatePlayer(env, token);
  if (!actor) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }
  await ensurePlayerRow(env, actor);

  const actorRole = await getMemberRole(env, guildId, actor.uuid);
  if (!actorRole || (actorRole !== "OWNER" && actorRole !== "MODERATOR")) {
    return NextResponse.json({error: "Forbidden"}, {status: 403});
  }

  const body = (await request.json().catch(() => null)) as {
    targetUuid?: string;
    reason?: string;
    reasonPublic?: boolean;
  } | null;
  const targetUuid = body?.targetUuid ?? "";
  if (!targetUuid) {
    return NextResponse.json({error: "Missing targetUuid"}, {status: 400});
  }

  await env.interchat
    .prepare(
      "INSERT OR REPLACE INTO guild_bans (guild_id, uuid, reason, reason_public) VALUES (?, ?, ?, ?)"
    )
    .bind(guildId, targetUuid, body?.reason ?? null, body?.reasonPublic ? 1 : 0)
    .run();
  await env.interchat
    .prepare("DELETE FROM guild_members WHERE guild_id = ? AND uuid = ?")
    .bind(guildId, targetUuid)
    .run();

  await submitGuildLog(
    env,
    guildId,
    actor.uuid,
    actor.username,
    `Banned ${targetUuid}${body?.reason ? ` for: ${body.reason}` : ""}`
  );

  return NextResponse.json({ok: true});
}

export async function DELETE(request: Request, context: { params: Promise<{id: string}> }) {
  const {env} = getCloudflareContext();
  const {id} = await context.params;
  const guildId = Number(id);
  if (!Number.isFinite(guildId)) {
    return NextResponse.json({error: "Invalid guild id"}, {status: 400});
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }
  const actor = await getOrCreatePlayer(env, token);
  if (!actor) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }
  await ensurePlayerRow(env, actor);

  const actorRole = await getMemberRole(env, guildId, actor.uuid);
  if (!actorRole || (actorRole !== "OWNER" && actorRole !== "MODERATOR")) {
    return NextResponse.json({error: "Forbidden"}, {status: 403});
  }

  const {searchParams} = new URL(request.url);
  const targetUuid = searchParams.get("targetUuid") ?? "";
  if (!targetUuid) {
    return NextResponse.json({error: "Missing targetUuid"}, {status: 400});
  }

  await env.interchat
    .prepare("DELETE FROM guild_bans WHERE guild_id = ? AND uuid = ?")
    .bind(guildId, targetUuid)
    .run();
  await submitGuildLog(env, guildId, actor.uuid, actor.username, `Unbanned ${targetUuid}`);

  return NextResponse.json({ok: true});
}
