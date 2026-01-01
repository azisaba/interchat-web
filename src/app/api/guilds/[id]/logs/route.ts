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

  const {searchParams} = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const offset = (page - 1) * 10;

  const result = await env.interchat
    .prepare(
      "SELECT id, guild_id, actor, actor_name, time, description FROM guild_logs WHERE guild_id = ? ORDER BY id DESC LIMIT 10 OFFSET ?"
    )
    .bind(guildId, offset)
    .all<{
      id: number;
      guild_id: number;
      actor: string;
      actor_name: string;
      time: number;
      description: string;
    }>();

  return NextResponse.json(result.results ?? []);
}
