import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {ensurePlayerRow, getBearerToken, getOrCreatePlayer} from "@/lib/server/interchat-auth";

export async function GET(request: Request) {
  const {env} = getCloudflareContext();
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }
  const player = await getOrCreatePlayer(env, token);
  if (!player) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }
  await ensurePlayerRow(env, player);

  const result = await env.interchat
    .prepare("SELECT blocked_uuid FROM blocked_users WHERE id = ?")
    .bind(player.uuid)
    .all<{blocked_uuid: string}>();

  return NextResponse.json(result.results?.map((row) => row.blocked_uuid) ?? []);
}
