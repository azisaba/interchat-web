import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";

type BulkMessage = {
  guild_id: number;
  sender: string;
  server: string;
  message: string;
  transliterated_message: string | null;
  timestamp: number;
};

function buildKey(item: BulkMessage) {
  return [
    item.guild_id,
    item.sender,
    item.server,
    item.timestamp,
    item.message,
    item.transliterated_message ?? "",
  ].join("|");
}

export async function POST(request: Request) {
  const {env} = getCloudflareContext();
  const body = (await request.json().catch(() => null)) as {messages?: BulkMessage[]} | null;
  const messages = body?.messages ?? [];
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({error: "Missing messages"}, {status: 400});
  }
  if (messages.length > 50) {
    return NextResponse.json({error: "Too many messages"}, {status: 400});
  }

  const unique = new Map<string, BulkMessage>();
  for (const item of messages) {
    if (
      !Number.isFinite(item.guild_id) ||
      !item.sender ||
      !item.server ||
      !item.message ||
      !Number.isFinite(item.timestamp)
    ) {
      continue;
    }
    unique.set(buildKey(item), item);
  }

  const inserted: Array<BulkMessage & {id?: number}> = [];
  let skipped = 0;

  for (const item of unique.values()) {
    const exists = await env.interchat
      .prepare(
        "SELECT 1 FROM guild_messages WHERE guild_id = ? AND sender = ? AND server = ? AND message = ? AND transliterated_message IS ? AND `timestamp` = ? LIMIT 1"
      )
      .bind(
        item.guild_id,
        item.sender,
        item.server,
        item.message,
        item.transliterated_message,
        item.timestamp
      )
      .all<{1: number}>();
    if ((exists.results?.length ?? 0) > 0) {
      skipped += 1;
      continue;
    }

    const result = await env.interchat
      .prepare(
        "INSERT INTO guild_messages (guild_id, server, sender, message, transliterated_message, `timestamp`) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .bind(
        item.guild_id,
        item.server,
        item.sender,
        item.message,
        item.transliterated_message,
        item.timestamp
      )
      .run();
    inserted.push({...item, id: result.meta?.last_row_id});
  }

  const payload = inserted.map((item) => ({
    type: "guild_message",
    id: item.id,
    guild_id: item.guild_id,
    server: item.server,
    sender: item.sender,
    message: item.message,
    transliterated_message: item.transliterated_message,
    timestamp: item.timestamp,
  }));

  if (payload.length > 0) {
    const stub = env.INTERCHAT_GUILD.get(env.INTERCHAT_GUILD.idFromName("global"));
    await stub.fetch("https://interchat.local/internal/broadcast", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({messages: payload}),
    });
  }

  return NextResponse.json({
    inserted: inserted.length,
    skipped,
  });
}
