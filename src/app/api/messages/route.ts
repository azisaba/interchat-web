import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";

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

  const rawAuth = request.headers.get("authorization");
  if (!rawAuth) {
    return NextResponse.json({error: "Missing Authorization header"}, {status: 401});
  }
  const token = rawAuth.startsWith("Bearer ") ? rawAuth.slice(7).trim() : rawAuth.trim();
  if (!token) {
    return NextResponse.json({error: "Missing token"}, {status: 401});
  }

  const meResponse = await fetch("https://api-ktor.azisaba.net/players/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!meResponse.ok) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }
  const me = (await meResponse.json()) as {uuid?: string};
  if (!me.uuid) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }

  const membersResponse = await fetch(
    `https://api-ktor.azisaba.net/interchat/guilds/${guildId}/members`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!membersResponse.ok) {
    return NextResponse.json({error: "Unable to read members"}, {status: 403});
  }
  const members = (await membersResponse.json()) as Array<{uuid: string}>;
  const isMember = members.some((member) => member.uuid === me.uuid);
  if (!isMember) {
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
