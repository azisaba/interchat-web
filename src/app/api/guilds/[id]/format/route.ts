import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {ensurePlayerRow, getBearerToken, getMemberRole, getOrCreatePlayer} from "@/lib/server/interchat-auth";
import {submitGuildLog} from "@/lib/server/guild-db";

export async function PATCH(request: Request, context: { params: Promise<{id: string}> }) {
  const {env} = getCloudflareContext();
  const {id} = await context.params;
  const guildId = Number(id);
  if (!Number.isFinite(guildId)) {
    return NextResponse.json({error: "Invalid guild id"}, {status: 400});
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }
  const player = await getOrCreatePlayer(env, token);
  if (!player) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }
  await ensurePlayerRow(env, player);

  const role = await getMemberRole(env, guildId, player.uuid);
  if (!role || (role !== "OWNER" && role !== "MODERATOR")) {
    return NextResponse.json({error: "Forbidden"}, {status: 403});
  }

  const body = (await request.json().catch(() => null)) as {format?: string} | null;
  const format = body?.format ?? "";
  if (!format.trim()) {
    return NextResponse.json({error: "Invalid format"}, {status: 400});
  }

  await env.interchat
    .prepare("UPDATE guilds SET format = ? WHERE id = ?")
    .bind(format, guildId)
    .run();
  await submitGuildLog(env, guildId, player.uuid, player.username, `Set format to ${format}`);

  return NextResponse.json({ok: true});
}
