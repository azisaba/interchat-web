// OpenNext worker is generated at build time; import it dynamically at runtime.

type Env = {
  interchat: D1Database;
  ASSETS: Fetcher;
  INTERCHAT_GUILD: DurableObjectNamespace;
};

type PlayerRecord = {
  uuid: string;
  username: string;
};

type MembershipCache = {
  ok: boolean;
  ts: number;
};

const MEMBERSHIP_CACHE_MS = 45000;
const API_DOWN_GRACE_MS = 30 * 60 * 1000;

function parseBearerToken(headerValue: string | null) {
  if (!headerValue) return null;
  const trimmed = headerValue.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("Bearer ") ? trimmed.slice(7).trim() : trimmed;
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return atob(padded);
}

function parseTokenFromProtocols(headerValue: string | null) {
  if (!headerValue) return {token: null, protocol: null};
  const parts = headerValue
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2 && parts[0].toLowerCase() === "bearer") {
    return {token: parts[1], protocol: parts[0]};
  }
  if (parts.length >= 2 && parts[0].toLowerCase() === "bearer-b64") {
    try {
      const decoded = decodeBase64Url(parts[1]);
      return {token: decoded, protocol: parts[0]};
    } catch {
      return {token: null, protocol: parts[0]};
    }
  }
  return {token: null, protocol: null};
}

export class InterchatGuild {
  private state: DurableObjectState;
  private env: Env;
  private guildId: number;
  private sockets = new Set<WebSocket>();
  private socketUsers = new Map<WebSocket, PlayerRecord>();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.guildId = Number.NaN;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/api\/guilds\/(\d+)\/stream$/);
    if (match) {
      this.guildId = Number(match[1]);
    }
    if (Number.isNaN(this.guildId)) {
      const name = this.state.id.name ?? "";
      this.guildId = Number(name);
    }

    if (request.headers.get("upgrade") !== "websocket") {
      console.log("DO: missing websocket upgrade", request.headers.get("upgrade"));
      return new Response("Upgrade required", {status: 426});
    }

    const authHeader = request.headers.get("authorization");
    let token = parseBearerToken(authHeader);
    let protocol: string | null = null;
    if (!token) {
      const parsed = parseTokenFromProtocols(request.headers.get("sec-websocket-protocol"));
      token = parsed.token;
      protocol = parsed.protocol;
    }

    if (!token || Number.isNaN(this.guildId)) {
      console.log("DO: missing token or invalid guild", {
        guildId: this.guildId,
        hasToken: !!token,
      });
      return new Response("Unauthorized", {status: 401});
    }

    const player = await this.getPlayer(token);
    if (!player) {
      console.log("DO: token not found in interchat_players", {
        guildId: this.guildId,
      });
      return new Response("Unauthorized", {status: 401});
    }
    const isMember = await this.checkMembership(token, player.uuid);
    if (!isMember) {
      console.log("DO: membership check failed", {
        guildId: this.guildId,
        uuid: player.uuid,
      });
      return new Response("Forbidden", {status: 403});
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    this.sockets.add(server);
    this.socketUsers.set(server, player);

    server.addEventListener("message", (event) => {
      this.handleMessage(server, event);
    });
    server.addEventListener("close", () => {
      this.sockets.delete(server);
      this.socketUsers.delete(server);
    });
    server.addEventListener("error", () => {
      this.sockets.delete(server);
      this.socketUsers.delete(server);
    });

    const response = new Response(null, {
      status: 101,
      webSocket: client,
    });
    if (protocol) {
      response.headers.set("Sec-WebSocket-Protocol", protocol);
    }
    return response;
  }

  private async getPlayer(token: string) {
    const result = await this.env.interchat
      .prepare("SELECT uuid, username FROM interchat_players WHERE key = ?")
      .bind(token)
      .all<PlayerRecord>();
    const existing = result.results?.[0] ?? null;
    if (existing) return existing;

    const response = await fetch("https://api-ktor.azisaba.net/players/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      return null;
    }
    const player = (await response.json()) as {uuid?: string; name?: string};
    if (!player.uuid || !player.name) {
      return null;
    }
    await this.env.interchat
      .prepare("INSERT OR REPLACE INTO interchat_players (key, uuid, username) VALUES (?, ?, ?)")
      .bind(token, player.uuid, player.name)
      .run();
    return {uuid: player.uuid, username: player.name};
  }

  private async handleMessage(socket: WebSocket, event: MessageEvent) {
    const player = this.socketUsers.get(socket);
    if (!player) return;
    const data = typeof event.data === "string" ? event.data : "";
    if (!data) return;
    let parsed: {type?: string; guildId?: number; message?: string} | null = null;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }
    if (!parsed || parsed.type !== "message") return;
    if (!parsed.message || typeof parsed.message !== "string") return;
    if (parsed.guildId !== this.guildId) return;

    const timestamp = Date.now();
    // TODO: re-enable once DO is the only writer.
    // const insertResult = await this.env.interchat
    //   .prepare(
    //     "INSERT INTO guild_messages (guild_id, server, sender, message, transliterated_message, `timestamp`) VALUES (?, ?, ?, ?, ?, ?)"
    //   )
    //   .bind(this.guildId, "Web", player.uuid, parsed.message, null, timestamp)
    //   .run();
    // const id = insertResult.meta?.last_row_id ?? undefined;
    const id = undefined;

    const payload = JSON.stringify({
      type: "guild_message",
      id,
      guild_id: this.guildId,
      server: "Web",
      sender: player.uuid,
      message: parsed.message,
      transliterated_message: null,
      timestamp,
    });

    for (const ws of this.sockets) {
      try {
        ws.send(payload);
      } catch {
        this.sockets.delete(ws);
        this.socketUsers.delete(ws);
      }
    }
  }

  private async checkMembership(token: string, uuid: string) {
    const cacheKey = `member:${token}`;
    const cached = await this.state.storage.get<MembershipCache>(cacheKey);
    const now = Date.now();
    if (cached && now - cached.ts < MEMBERSHIP_CACHE_MS) {
      return cached.ok;
    }

    try {
      const response = await fetch(
        `https://api-ktor.azisaba.net/interchat/guilds/${this.guildId}/members`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        if (cached && cached.ok && now - cached.ts < API_DOWN_GRACE_MS) {
          return true;
        }
        return false;
      }
      const members = (await response.json()) as Array<{uuid: string}>;
      const ok = members.some((member) => member.uuid === uuid);
      await this.state.storage.put(cacheKey, {ok, ts: now});
      return ok;
    } catch {
      if (cached && cached.ok && now - cached.ts < API_DOWN_GRACE_MS) {
        return true;
      }
      return false;
    }
  }
}

const handler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const streamMatch = url.pathname.match(/^\/api\/guilds\/(\d+)\/stream$/);
    if (streamMatch) {
      const guildId = streamMatch[1];
      const id = env.INTERCHAT_GUILD.idFromName(guildId);
      const stub = env.INTERCHAT_GUILD.get(id);
      return stub.fetch(request);
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore worker.js does not exist as of compile time
    const openNextWorker = (await import("./.open-next/worker.js")).default;
    return openNextWorker.fetch(request, env, ctx);
  },
};

export default handler;
