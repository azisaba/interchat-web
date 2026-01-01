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
    .prepare(
      "SELECT g.id, g.name, g.format, g.capacity, g.deleted, g.open FROM guild_members m JOIN guilds g ON g.id = m.guild_id WHERE m.uuid = ? AND g.deleted = 0 ORDER BY g.name"
    )
    .bind(player.uuid)
    .all<{
      id: number;
      name: string;
      format: string;
      capacity: number;
      deleted: number;
      open: number;
    }>();

  return NextResponse.json(result.results ?? []);
}
