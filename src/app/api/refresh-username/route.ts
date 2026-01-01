import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {getBearerToken} from "@/lib/server/interchat-auth";
import {fetchMojangProfile} from "@/lib/server/mojang";

const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const {env} = getCloudflareContext();
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }

  const existing = await env.interchat
    .prepare(
      "SELECT uuid, username, username_refreshed_at FROM interchat_players WHERE key = ?"
    )
    .bind(token)
    .all<{uuid: string; username: string; username_refreshed_at: number}>();
  const row = existing.results?.[0] ?? null;
  if (!row) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }

  const now = Date.now();
  const lastRefreshed = row.username_refreshed_at ?? 0;
  if (lastRefreshed > 0 && now - lastRefreshed < COOLDOWN_MS) {
    return NextResponse.json(
      {error: "Cooldown", retry_after_ms: COOLDOWN_MS - (now - lastRefreshed)},
      {status: 429}
    );
  }

  const profile = await fetchMojangProfile(row.uuid);
  if (!profile) {
    return NextResponse.json({error: "Unable to fetch Mojang profile"}, {status: 502});
  }

  await env.interchat
    .prepare("UPDATE interchat_players SET username = ?, username_refreshed_at = ? WHERE key = ?")
    .bind(profile.name, now, token)
    .run();
  await env.interchat
    .prepare("UPDATE players SET name = ? WHERE id = ?")
    .bind(profile.name, row.uuid)
    .run();

  return NextResponse.json({uuid: row.uuid, username: profile.name});
}
