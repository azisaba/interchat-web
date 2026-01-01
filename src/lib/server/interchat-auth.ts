export type AuthPlayer = {
  uuid: string;
  username: string;
  token: string;
};

export function getBearerToken(request: Request) {
  const rawAuth = request.headers.get("authorization");
  if (!rawAuth) return null;
  const trimmed = rawAuth.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("Bearer ") ? trimmed.slice(7).trim() : trimmed;
}

export async function getOrCreatePlayer(env: CloudflareEnv, token: string) {
  const existing = await env.interchat
    .prepare("SELECT uuid, username FROM interchat_players WHERE key = ?")
    .bind(token)
    .all<{uuid: string; username: string}>();
  const row = existing.results?.[0];
  if (row) {
    return {uuid: row.uuid, username: row.username, token};
  }

  const response = await fetch("https://api-ktor.azisaba.net/players/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  const player = (await response.json()) as {uuid?: string; name?: string};
  if (!player.uuid || !player.name) return null;

  await env.interchat
    .prepare("INSERT OR REPLACE INTO interchat_players (key, uuid, username) VALUES (?, ?, ?)")
    .bind(token, player.uuid, player.name)
    .run();

  return {uuid: player.uuid, username: player.name, token};
}

export async function ensurePlayerRow(env: CloudflareEnv, player: AuthPlayer) {
  await env.interchat
    .prepare("INSERT OR IGNORE INTO players (id, name) VALUES (?, ?)")
    .bind(player.uuid, player.username)
    .run();
  await env.interchat
    .prepare("UPDATE players SET name = ? WHERE id = ?")
    .bind(player.username, player.uuid)
    .run();
}

export async function getMemberRole(env: CloudflareEnv, guildId: number, uuid: string) {
  const result = await env.interchat
    .prepare("SELECT role FROM guild_members WHERE guild_id = ? AND uuid = ?")
    .bind(guildId, uuid)
    .all<{role: string}>();
  return result.results?.[0]?.role ?? null;
}

export async function isGuildMember(env: CloudflareEnv, guildId: number, uuid: string) {
  const result = await env.interchat
    .prepare("SELECT 1 FROM guild_members WHERE guild_id = ? AND uuid = ?")
    .bind(guildId, uuid)
    .all<{1: number}>();
  return (result.results?.length ?? 0) > 0;
}
