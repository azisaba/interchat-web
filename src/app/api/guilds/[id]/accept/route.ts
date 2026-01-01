import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {countGuildMembers, submitGuildLog} from "@/lib/server/guild-db";
import {ensurePlayerRow, getBearerToken, getOrCreatePlayer} from "@/lib/server/interchat-auth";

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

  const guild = await env.interchat
    .prepare("SELECT id, open, capacity FROM guilds WHERE id = ? AND deleted = 0")
    .bind(guildId)
    .all<{id: number; open: number; capacity: number}>();
  const guildRow = guild.results?.[0];
  if (!guildRow) {
    return NextResponse.json({error: "Guild not found"}, {status: 404});
  }

  const banned = await env.interchat
    .prepare("SELECT 1 FROM guild_bans WHERE guild_id = ? AND uuid = ?")
    .bind(guildId, player.uuid)
    .all<{1: number}>();
  if ((banned.results?.length ?? 0) > 0) {
    return NextResponse.json({error: "You are banned"}, {status: 403});
  }

  const invite = await env.interchat
    .prepare("SELECT actor, expires_at FROM guild_invites WHERE guild_id = ? AND target = ?")
    .bind(guildId, player.uuid)
    .all<{actor: string; expires_at: number}>();
  const inviteRow = invite.results?.[0] ?? null;
  const now = Date.now();
  const hasValidInvite = inviteRow ? inviteRow.expires_at > now : false;
  const isOpen = guildRow.open === 1;

  if (!hasValidInvite && !isOpen) {
    return NextResponse.json({error: "No invite"}, {status: 403});
  }

  const memberCount = await countGuildMembers(env, guildId);
  if (memberCount >= guildRow.capacity) {
    return NextResponse.json({error: "Guild is full"}, {status: 409});
  }

  await env.interchat
    .prepare("INSERT OR IGNORE INTO guild_members (guild_id, uuid, role) VALUES (?, ?, ?)")
    .bind(guildId, player.uuid, "MEMBER")
    .run();
  await env.interchat
    .prepare("DELETE FROM guild_invites WHERE guild_id = ? AND target = ?")
    .bind(guildId, player.uuid)
    .run();
  await env.interchat
    .prepare("UPDATE players SET selected_guild = ? WHERE id = ?")
    .bind(guildId, player.uuid)
    .run();

  const logMessage = hasValidInvite
    ? `Accepted invite from ${inviteRow?.actor ?? "unknown"}`
    : "Joined via open guild";
  await submitGuildLog(env, guildId, player.uuid, player.username, logMessage);

  return NextResponse.json({ok: true});
}
