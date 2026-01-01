import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {ensurePlayerRow, getBearerToken, getMemberRole, getOrCreatePlayer} from "@/lib/server/interchat-auth";
import {submitGuildLog} from "@/lib/server/guild-db";

export async function PATCH(request: Request, context: { params: Promise<{id: string}> }) {
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
  if (!actorRole || actorRole !== "OWNER") {
    return NextResponse.json({error: "Forbidden"}, {status: 403});
  }

  const body = (await request.json().catch(() => null)) as {
    targetUuid?: string;
    nickname?: string | null;
  } | null;
  const targetUuid = body?.targetUuid ?? "";
  if (!targetUuid) {
    return NextResponse.json({error: "Missing targetUuid"}, {status: 400});
  }
  const nicknameRaw = body?.nickname ?? null;
  const nickname = nicknameRaw === "off" ? null : nicknameRaw;

  await env.interchat
    .prepare("UPDATE guild_members SET nickname = ? WHERE guild_id = ? AND uuid = ?")
    .bind(nickname, guildId, targetUuid)
    .run();
  await submitGuildLog(
    env,
    guildId,
    actor.uuid,
    actor.username,
    `Changed nickname of ${targetUuid} to ${nickname ?? "off"}`
  );

  return NextResponse.json({ok: true, nickname});
}
