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

  await env.interchat.prepare("UPDATE guilds SET deleted = 0 WHERE id = ?").bind(guildId).run();
  await submitGuildLog(env, guildId, actor.uuid, actor.username, "Restored guild");

  return NextResponse.json({ok: true});
}
