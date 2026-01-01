import {NextResponse} from "next/server";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {fetchMojangProfile} from "@/lib/server/mojang";

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

  const profile = await fetchMojangProfile(uuid);
  if (!profile) {
    return NextResponse.json({error: "Unable to fetch Mojang profile"}, {status: 404});
  }

  await env.interchat
    .prepare("INSERT OR REPLACE INTO interchat_players (key, uuid, username) VALUES (?, ?, ?)")
    .bind(token, uuid, profile.name)
    .run();

  return NextResponse.json({token, uuid, username: profile.name});
}
