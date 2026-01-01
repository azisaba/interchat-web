import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {ensurePlayerRow, getBearerToken, getMemberRole, getOrCreatePlayer} from "@/lib/server/interchat-auth";
import {submitGuildLog} from "@/lib/server/guild-db";

export async function POST(request: Request, context: { params: Promise<{id: string}> }) {
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
  const actor = await getOrCreatePlayer(env, token);
  if (!actor) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }
  await ensurePlayerRow(env, actor);

  const role = await getMemberRole(env, guildId, actor.uuid);
  if (!role || role !== "OWNER") {
    return NextResponse.json({error: "Forbidden"}, {status: 403});
  }

  await env.interchat.prepare("DELETE FROM guild_bans WHERE guild_id = ?").bind(guildId).run();
  await env.interchat.prepare("DELETE FROM guild_members WHERE guild_id = ?").bind(guildId).run();
  await env.interchat.prepare("DELETE FROM guilds WHERE id = ?").bind(guildId).run();
  await env.interchat
    .prepare("UPDATE players SET selected_guild = -1 WHERE selected_guild = ?")
    .bind(guildId)
    .run();
  await env.interchat
    .prepare("UPDATE players SET focused_guild = -1 WHERE focused_guild = ?")
    .bind(guildId)
    .run();

  await submitGuildLog(env, guildId, actor.uuid, actor.username, "Deleted guild (hard)");

  return NextResponse.json({ok: true});
}
