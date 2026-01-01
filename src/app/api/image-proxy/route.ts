import {NextResponse} from "next/server";

function isAllowedUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const {searchParams} = new URL(request.url);
  const target = searchParams.get("url");
  if (!target || !isAllowedUrl(target)) {
    return NextResponse.json({error: "Invalid URL"}, {status: 400});
  }

  const response = await fetch(target);
  if (!response.ok) {
    return NextResponse.json({error: "Unable to fetch image"}, {status: 502});
  }

  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const body = await response.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=3600",
    },
  });
}
