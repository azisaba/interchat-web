import {headers} from "next/headers";
import {getCloudflareContext} from "@opennextjs/cloudflare";

export async function getMessages(guildId: string) {
  // Database schema is InterChatGuildMessage without type property and with id property (primary key)
  const {env} = getCloudflareContext();
  const id = Number(guildId);
  if (!Number.isFinite(id)) return [];

  const requestHeaders = await headers();
  const rawAuth =
    requestHeaders.get("authorization") ?? requestHeaders.get("Authorization");
  if (!rawAuth) return [];
  const token = rawAuth.startsWith("Bearer ") ? rawAuth.slice(7).trim() : rawAuth.trim();
  if (!token) return [];

  const meResponse = await fetch("https://api-ktor.azisaba.net/players/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!meResponse.ok) return [];
  const me = (await meResponse.json()) as {uuid?: string};
  if (!me.uuid) return [];

  const membersResponse = await fetch(
    `https://api-ktor.azisaba.net/interchat/guilds/${id}/members`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!membersResponse.ok) return [];
  const members = (await membersResponse.json()) as Array<{uuid: string}>;
  const isMember = members.some((member) => member.uuid === me.uuid);
  if (!isMember) return [];

  const result = await env.interchat
    .prepare(
      "SELECT id, guild_id, server, sender, message, transliterated_message FROM guild_messages WHERE guild_id = ? ORDER BY id DESC LIMIT 50"
    )
    .bind(id)
    .all<{
      id: number;
      guild_id: number;
      server: string;
      sender: string;
      message: string;
      transliterated_message: string | null;
    }>();

  return result.results ?? [];
}
