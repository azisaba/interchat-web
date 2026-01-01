export async function submitGuildLog(
  env: CloudflareEnv,
  guildId: number,
  actorUuid: string,
  actorName: string,
  description: string
) {
  await env.interchat
    .prepare(
      "INSERT INTO guild_logs (guild_id, actor, actor_name, time, description) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(guildId, actorUuid, actorName, Date.now(), description)
    .run();
}

export async function countGuildMembers(env: CloudflareEnv, guildId: number) {
  const result = await env.interchat
    .prepare("SELECT COUNT(*) as count FROM guild_members WHERE guild_id = ?")
    .bind(guildId)
    .all<{count: number}>();
  return result.results?.[0]?.count ?? 0;
}
