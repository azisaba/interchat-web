import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {countGuildMembers, submitGuildLog} from "@/lib/server/guild-db";
import {ensurePlayerRow, getBearerToken, getMemberRole, getOrCreatePlayer} from "@/lib/server/interchat-auth";

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
  if (!role) {
    return NextResponse.json({error: "Not a member"}, {status: 403});
  }

  if (role === "OWNER") {
    const ownerCountResult = await env.interchat
      .prepare("SELECT COUNT(*) as count FROM guild_members WHERE guild_id = ? AND role = 'OWNER'")
      .bind(guildId)
      .all<{count: number}>();
    const ownerCount = ownerCountResult.results?.[0]?.count ?? 0;
    if (ownerCount <= 1) {
      return NextResponse.json({error: "Owner cannot leave"}, {status: 409});
    }
  }

  await env.interchat
    .prepare("DELETE FROM guild_members WHERE guild_id = ? AND uuid = ?")
    .bind(guildId, player.uuid)
    .run();
  await env.interchat
    .prepare(
      "UPDATE players SET selected_guild = -1, focused_guild = -1 WHERE id = ? AND (selected_guild = ? OR focused_guild = ?)"
    )
    .bind(player.uuid, guildId, guildId)
    .run();

  await submitGuildLog(env, guildId, player.uuid, player.username, "Left the guild");

  const remaining = await countGuildMembers(env, guildId);
  return NextResponse.json({ok: true, remaining});
}
