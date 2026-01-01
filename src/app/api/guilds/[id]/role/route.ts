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
  if (!role || role !== "OWNER") {
    return NextResponse.json({error: "Forbidden"}, {status: 403});
  }

  const body = (await request.json().catch(() => null)) as {
    targetUuid?: string;
    role?: "OWNER" | "MODERATOR" | "MEMBER";
  } | null;
  const targetUuid = body?.targetUuid ?? "";
  const targetRole = body?.role ?? "";
  if (!targetUuid || !targetRole) {
    return NextResponse.json({error: "Missing targetUuid or role"}, {status: 400});
  }

  await env.interchat
    .prepare("UPDATE guild_members SET role = ? WHERE guild_id = ? AND uuid = ?")
    .bind(targetRole, guildId, targetUuid)
    .run();
  await submitGuildLog(
    env,
    guildId,
    player.uuid,
    player.username,
    `Changed role of ${targetUuid} to ${targetRole}`
  );

  return NextResponse.json({ok: true});
}
