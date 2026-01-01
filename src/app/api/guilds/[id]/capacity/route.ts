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
  const actor = await getOrCreatePlayer(env, token);
  if (!actor) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }
  await ensurePlayerRow(env, actor);

  const role = await getMemberRole(env, guildId, actor.uuid);
  if (!role || role !== "OWNER") {
    return NextResponse.json({error: "Forbidden"}, {status: 403});
  }

  const body = (await request.json().catch(() => null)) as {capacity?: number} | null;
  const capacity = Number(body?.capacity);
  if (!Number.isFinite(capacity) || capacity < 1) {
    return NextResponse.json({error: "Invalid capacity"}, {status: 400});
  }

  await env.interchat.prepare("UPDATE guilds SET capacity = ? WHERE id = ?").bind(capacity, guildId).run();
  await submitGuildLog(env, guildId, actor.uuid, actor.username, `Set guild capacity to ${capacity}`);

  return NextResponse.json({ok: true});
}
