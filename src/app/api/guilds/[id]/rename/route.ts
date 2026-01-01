import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {BLOCKED_GUILD_NAMES, GUILD_NAME_PATTERN} from "@/lib/server/guild-constants";
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

  const body = (await request.json().catch(() => null)) as {name?: string} | null;
  const name = body?.name?.trim() ?? "";
  if (!GUILD_NAME_PATTERN.test(name) || BLOCKED_GUILD_NAMES.has(name.toLowerCase())) {
    return NextResponse.json({error: "Invalid guild name"}, {status: 400});
  }

  await env.interchat.prepare("UPDATE guilds SET name = ? WHERE id = ?").bind(name, guildId).run();
  await submitGuildLog(env, guildId, actor.uuid, actor.username, `Renamed guild to ${name}`);

  return NextResponse.json({ok: true});
}
