import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {
  ensurePlayerRow,
  getBearerToken,
  getMemberRole,
  getOrCreatePlayer,
  isGuildMember,
} from "@/lib/server/interchat-auth";
import {submitGuildLog} from "@/lib/server/guild-db";

const INVITE_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000;

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
  const player = await getOrCreatePlayer(env, token);
  if (!player) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }
  await ensurePlayerRow(env, player);

  const role = await getMemberRole(env, guildId, player.uuid);
  if (!role || (role !== "OWNER" && role !== "MODERATOR")) {
    return NextResponse.json({error: "Forbidden"}, {status: 403});
  }

  const body = (await request.json().catch(() => null)) as {targetUuid?: string} | null;
  const targetUuid = body?.targetUuid ?? "";
  if (!targetUuid) {
    return NextResponse.json({error: "Missing targetUuid"}, {status: 400});
  }

  const targetMember = await isGuildMember(env, guildId, targetUuid);
  if (targetMember) {
    return NextResponse.json({error: "Already a member"}, {status: 409});
  }

  const banned = await env.interchat
    .prepare("SELECT 1 FROM guild_bans WHERE guild_id = ? AND uuid = ?")
    .bind(guildId, targetUuid)
    .all<{1: number}>();
  if ((banned.results?.length ?? 0) > 0) {
    return NextResponse.json({error: "User is banned"}, {status: 403});
  }

  const accepting = await env.interchat
    .prepare("SELECT accepting_invites FROM players WHERE id = ?")
    .bind(targetUuid)
    .all<{accepting_invites: number}>();
  const acceptsInvites =
    accepting.results?.[0]?.accepting_invites === undefined
      ? true
      : accepting.results?.[0]?.accepting_invites === 1;
  if (!acceptsInvites) {
    return NextResponse.json({error: "Target does not accept invites"}, {status: 403});
  }

  const expiresAt = Date.now() + INVITE_EXPIRE_MS;
  await env.interchat
    .prepare(
      "INSERT OR REPLACE INTO guild_invites (guild_id, target, actor, expires_at) VALUES (?, ?, ?, ?)"
    )
    .bind(guildId, targetUuid, player.uuid, expiresAt)
    .run();

  await submitGuildLog(
    env,
    guildId,
    player.uuid,
    player.username,
    `Invited ${targetUuid}`
  );

  return NextResponse.json({guild_id: guildId, target: targetUuid, actor: player.uuid, expires_at: expiresAt});
}
