import {headers} from "next/headers";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {getBearerToken, getOrCreatePlayer, isGuildMember} from "@/lib/server/interchat-auth";

export async function getMessages(guildId: string) {
  // Database schema is InterChatGuildMessage without type property and with id property (primary key)
  const {env} = getCloudflareContext();
  const id = Number(guildId);
  if (!Number.isFinite(id)) return [];

  const requestHeaders = await headers();
  const token = getBearerToken(new Request("http://local", {headers: requestHeaders}));
  if (!token) return [];
  const player = await getOrCreatePlayer(env, token);
  if (!player) return [];
  const member = await isGuildMember(env, id, player.uuid);
  if (!member) return [];

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
