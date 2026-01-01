import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";

const API_DOWN_GRACE_MS = 30 * 60 * 1000;

type MembershipCacheRow = {
  ok: number;
  checked_at: number;
};

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

  let uuid: string | null = null;
  let username: string | null = null;
  try {
    const meResponse = await fetch("https://api-ktor.azisaba.net/players/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (meResponse.ok) {
      const me = (await meResponse.json()) as {uuid?: string; name?: string};
      uuid = me.uuid ?? null;
      username = me.name ?? null;
      if (uuid && username) {
        await env.interchat
          .prepare("INSERT OR REPLACE INTO interchat_players (key, uuid, username) VALUES (?, ?, ?)")
          .bind(token, uuid, username)
          .run();
      }
    }
  } catch {
    // fall back to cached player info
  }
  if (!uuid) {
    const cached = await env.interchat
      .prepare("SELECT uuid, username FROM interchat_players WHERE key = ?")
      .bind(token)
      .all<{uuid: string; username: string}>();
    const row = cached.results?.[0] ?? null;
    if (!row) {
      return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    uuid = row.uuid;
    username = row.username;
  }

  let isMember: boolean | null = null;
  try {
    const membersResponse = await fetch(
      `https://api-ktor.azisaba.net/interchat/guilds/${guildId}/members`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    if (membersResponse.ok) {
      const members = (await membersResponse.json()) as Array<{uuid: string}>;
      isMember = members.some((member) => member.uuid === uuid);
      await env.interchat
        .prepare(
          "INSERT OR REPLACE INTO interchat_memberships (key, guild_id, ok, checked_at) VALUES (?, ?, ?, ?)"
        )
        .bind(token, guildId, isMember ? 1 : 0, Date.now())
        .run();
    }
  } catch {
    // fall back to cached membership
  }
  if (isMember === null) {
    const cached = await env.interchat
      .prepare(
        "SELECT ok, checked_at FROM interchat_memberships WHERE key = ? AND guild_id = ?"
      )
      .bind(token, guildId)
      .all<MembershipCacheRow>();
    const row = cached.results?.[0] ?? null;
    if (!row) {
      return NextResponse.json({error: "Forbidden"}, {status: 403});
    }
    const withinGrace = Date.now() - row.checked_at <= API_DOWN_GRACE_MS;
    if (!withinGrace || row.ok !== 1) {
      return NextResponse.json({error: "Forbidden"}, {status: 403});
    }
  } else if (!isMember) {
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
