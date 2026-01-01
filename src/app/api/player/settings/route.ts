import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {ensurePlayerRow, getBearerToken, getOrCreatePlayer} from "@/lib/server/interchat-auth";

export async function PATCH(request: Request) {
  const {env} = getCloudflareContext();
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }
  const player = await getOrCreatePlayer(env, token);
  if (!player) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }
  await ensurePlayerRow(env, player);

  const body = (await request.json().catch(() => null)) as {
    acceptingInvites?: boolean;
    translateKana?: boolean;
    hideAllUntil?: number;
  } | null;
  if (!body) {
    return NextResponse.json({error: "Invalid body"}, {status: 400});
  }

  if (body.acceptingInvites !== undefined) {
    await env.interchat
      .prepare("UPDATE players SET accepting_invites = ? WHERE id = ?")
      .bind(body.acceptingInvites ? 1 : 0, player.uuid)
      .run();
  }
  if (body.translateKana !== undefined) {
    await env.interchat
      .prepare("UPDATE players SET translate_kana = ? WHERE id = ?")
      .bind(body.translateKana ? 1 : 0, player.uuid)
      .run();
  }
  if (body.hideAllUntil !== undefined) {
    await env.interchat
      .prepare("UPDATE players SET hide_all_until = ? WHERE id = ?")
      .bind(body.hideAllUntil, player.uuid)
      .run();
  }

  return NextResponse.json({ok: true});
}
