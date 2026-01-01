import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {ensurePlayerRow, getBearerToken, getOrCreatePlayer, isGuildMember} from "@/lib/server/interchat-auth";

export async function GET(request: Request) {
  const {env} = getCloudflareContext();
  const {searchParams} = new URL(request.url);
  const guildId = Number(searchParams.get("guildId"));
  const beforeIdRaw = searchParams.get("beforeId");
  const beforeId = beforeIdRaw ? Number(beforeIdRaw) : null;
  if (!Number.isFinite(guildId)) {
    return NextResponse.json({error: "Invalid guildId"}, {status: 400});
  }
  if (beforeIdRaw && !Number.isFinite(beforeId)) {
    return NextResponse.json({error: "Invalid beforeId"}, {status: 400});
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({error: "Missing Authorization header"}, {status: 401});
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

  const query =
    "SELECT id, guild_id, server, sender, message, transliterated_message, `timestamp` FROM guild_messages WHERE guild_id = ?" +
    (beforeId !== null ? " AND id < ?" : "") +
    " ORDER BY id DESC LIMIT 50";
  const statement = env.interchat.prepare(query);
  const result = await (beforeId !== null
    ? statement.bind(guildId, beforeId)
    : statement.bind(guildId)
  ).all<{
    id: number;
    guild_id: number;
    server: string;
    sender: string;
    message: string;
    transliterated_message: string | null;
    timestamp: number;
  }>();

  const rows = result.results ?? [];
  rows.reverse();
  return NextResponse.json(rows);
}
