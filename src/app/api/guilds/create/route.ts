import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {DEFAULT_FORMAT, BLOCKED_GUILD_NAMES, GUILD_NAME_PATTERN} from "@/lib/server/guild-constants";
import {ensurePlayerRow, getBearerToken, getOrCreatePlayer} from "@/lib/server/interchat-auth";
import {submitGuildLog} from "@/lib/server/guild-db";

export async function POST(request: Request) {
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

  const cooldownResult = await env.interchat
    .prepare("SELECT last_guild_created_at FROM players WHERE id = ?")
    .bind(player.uuid)
    .all<{last_guild_created_at: number}>();
  const lastCreatedAt = Number(cooldownResult.results?.[0]?.last_guild_created_at ?? 0);
  const cooldownMs = 14 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  if (lastCreatedAt > 0 && now - lastCreatedAt < cooldownMs) {
    const remainingMs = Math.max(0, cooldownMs - (now - lastCreatedAt));
    return NextResponse.json(
      {error: "Guild creation cooldown", retry_after_ms: remainingMs},
      {status: 429}
    );
  }

  const body = (await request.json().catch(() => null)) as {name?: string} | null;
  const name = body?.name?.trim() ?? "";
  if (!GUILD_NAME_PATTERN.test(name) || BLOCKED_GUILD_NAMES.has(name.toLowerCase())) {
    return NextResponse.json({error: "Invalid guild name"}, {status: 400});
  }

  const existing = await env.interchat
    .prepare("SELECT id FROM guilds WHERE name = ?")
    .bind(name)
    .all<{id: number}>();
  if ((existing.results?.length ?? 0) > 0) {
    return NextResponse.json({error: "Guild already exists"}, {status: 409});
  }

  const insertResult = await env.interchat
    .prepare(
      "INSERT INTO guilds (name, format, capacity, deleted, open) VALUES (?, ?, 100, 0, 0)"
    )
    .bind(name, DEFAULT_FORMAT)
    .run();
  const guildId = insertResult.meta?.last_row_id;
  if (!guildId) {
    return NextResponse.json({error: "Failed to create guild"}, {status: 500});
  }

  await env.interchat
    .prepare("INSERT INTO guild_members (guild_id, uuid, role) VALUES (?, ?, ?)")
    .bind(guildId, player.uuid, "OWNER")
    .run();
  await env.interchat
    .prepare("UPDATE players SET selected_guild = ?, last_guild_created_at = ? WHERE id = ?")
    .bind(guildId, now, player.uuid)
    .run();

  await submitGuildLog(env, guildId, player.uuid, player.username, "Created guild");

  return NextResponse.json({
    id: guildId,
    name,
    format: DEFAULT_FORMAT,
    capacity: 100,
    deleted: 0,
    open: 0,
  });
}
