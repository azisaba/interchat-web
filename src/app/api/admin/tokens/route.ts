import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {fetchMojangProfile} from "@/lib/server/mojang";

const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const {env} = getCloudflareContext();
  const body = (await request.json().catch(() => null)) as {uuid?: string; token?: string} | null;
  const uuid = body?.uuid?.trim() ?? "";
  const token = body?.token?.trim() ?? "";
  if (!uuid) {
    return NextResponse.json({error: "Missing uuid"}, {status: 400});
  }
  if (!token) {
    return NextResponse.json({error: "Missing token"}, {status: 400});
  }

  const existing = await env.interchat
    .prepare("SELECT username, username_refreshed_at FROM interchat_players WHERE key = ?")
    .bind(token)
    .all<{username: string; username_refreshed_at: number}>();
  const row = existing.results?.[0] ?? null;
  const now = Date.now();
  const lastRefreshed = row?.username_refreshed_at ?? 0;
  const canRefresh = lastRefreshed <= 0 || now - lastRefreshed >= COOLDOWN_MS;
  const shouldFetchProfile = !row || canRefresh;
  const profile = shouldFetchProfile ? await fetchMojangProfile(uuid) : null;
  if (shouldFetchProfile && !profile) {
    return NextResponse.json({error: "Unable to fetch Mojang profile"}, {status: 404});
  }
  const usernameToStore = profile?.name ?? row?.username ?? "";

  if (!row) {
    await env.interchat
      .prepare("INSERT INTO interchat_players (key, uuid, username) VALUES (?, ?, ?)")
      .bind(token, uuid, usernameToStore)
      .run();
  } else if (canRefresh) {
    await env.interchat
      .prepare(
        "UPDATE interchat_players SET uuid = ?, username = ?, username_refreshed_at = ? WHERE key = ?"
      )
      .bind(uuid, usernameToStore, now, token)
      .run();
  } else {
    await env.interchat
      .prepare("UPDATE interchat_players SET uuid = ?, username = ? WHERE key = ?")
      .bind(uuid, usernameToStore, token)
      .run();
  }

  return NextResponse.json({token, uuid, username: usernameToStore});
}
