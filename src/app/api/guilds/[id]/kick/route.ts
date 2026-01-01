import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {
  ensurePlayerRow,
  getBearerToken,
  getMemberRole,
  getOrCreatePlayer,
} from "@/lib/server/interchat-auth";
import {countGuildMembers, submitGuildLog} from "@/lib/server/guild-db";
import {hasHigherOrEqualRole, type GuildRole} from "@/lib/server/guild-permissions";

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

  const actorRole = (await getMemberRole(env, guildId, actor.uuid)) as GuildRole | null;
  if (!actorRole || (actorRole !== "OWNER" && actorRole !== "MODERATOR")) {
    return NextResponse.json({error: "Forbidden"}, {status: 403});
  }

  const body = (await request.json().catch(() => null)) as {
    targetUuid?: string;
    reason?: string;
  } | null;
  const targetUuid = body?.targetUuid ?? "";
  if (!targetUuid) {
    return NextResponse.json({error: "Missing targetUuid"}, {status: 400});
  }

  const targetRole = (await getMemberRole(env, guildId, targetUuid)) as GuildRole | null;
  if (!targetRole) {
    return NextResponse.json({error: "Target is not a member"}, {status: 404});
  }

  if (actorRole !== "OWNER" && hasHigherOrEqualRole(actorRole, targetRole)) {
    return NextResponse.json({error: "Forbidden"}, {status: 403});
  }

  if (targetRole === "OWNER") {
    const ownerCountResult = await env.interchat
      .prepare("SELECT COUNT(*) as count FROM guild_members WHERE guild_id = ? AND role = 'OWNER'")
      .bind(guildId)
      .all<{count: number}>();
    const ownerCount = ownerCountResult.results?.[0]?.count ?? 0;
    if (ownerCount <= 1) {
      return NextResponse.json({error: "Not enough owners"}, {status: 409});
    }
  }

  const memberCount = await countGuildMembers(env, guildId);
  if (memberCount <= 1) {
    await env.interchat.prepare("UPDATE guilds SET deleted = 1 WHERE id = ?").bind(guildId).run();
  }

  await env.interchat
    .prepare("DELETE FROM guild_members WHERE guild_id = ? AND uuid = ?")
    .bind(guildId, targetUuid)
    .run();
  await env.interchat
    .prepare("UPDATE players SET selected_guild = -1 WHERE selected_guild = ? AND id = ?")
    .bind(guildId, targetUuid)
    .run();
  await env.interchat
    .prepare("UPDATE players SET focused_guild = -1 WHERE focused_guild = ? AND id = ?")
    .bind(guildId, targetUuid)
    .run();

  const reason = body?.reason ?? "no reason";
  await submitGuildLog(
    env,
    guildId,
    actor.uuid,
    actor.username,
    `Kicked ${targetUuid} for: ${reason}`
  );

  return NextResponse.json({ok: true});
}
