import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {ensurePlayerRow, getBearerToken, getOrCreatePlayer, isGuildMember} from "@/lib/server/interchat-auth";

export async function GET(request: Request, context: { params: Promise<{id: string}> }) {
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
  const member = await isGuildMember(env, guildId, player.uuid);
  if (!member) {
    return NextResponse.json({error: "Forbidden"}, {status: 403});
  }

  const result = await env.interchat
    .prepare(
      "SELECT m.guild_id, m.uuid, m.role, m.nickname, p.name FROM guild_members m LEFT JOIN players p ON p.id = m.uuid WHERE m.guild_id = ?"
    )
    .bind(guildId)
    .all<{
      guild_id: number;
      uuid: string;
      role: string;
      nickname: string | null;
      name: string | null;
    }>();

  const members = (result.results ?? []).map((row) => ({
    guild_id: row.guild_id,
    uuid: row.uuid,
    role: row.role,
    nickname: row.nickname,
    name: row.name ?? row.uuid,
  }));

  return NextResponse.json(members);
}
