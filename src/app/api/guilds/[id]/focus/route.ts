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

  await env.interchat
    .prepare("UPDATE players SET focused_guild = ? WHERE id = ?")
    .bind(guildId, player.uuid)
    .run();

  return NextResponse.json({ok: true});
}
