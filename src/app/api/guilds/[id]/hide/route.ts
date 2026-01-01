import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";
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
    return NextResponse.json({error: "Forbidden"}, {status: 403});
  }

  const current = await env.interchat
    .prepare("SELECT hidden_by_member FROM guild_members WHERE guild_id = ? AND uuid = ?")
    .bind(guildId, player.uuid)
    .all<{hidden_by_member: number}>();
  const isHidden = current.results?.[0]?.hidden_by_member === 1;

  await env.interchat
    .prepare("UPDATE guild_members SET hidden_by_member = ? WHERE guild_id = ? AND uuid = ?")
    .bind(isHidden ? 0 : 1, guildId, player.uuid)
    .run();

  return NextResponse.json({ok: true, hidden: !isHidden});
}
