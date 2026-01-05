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

type SocketMeta = {
  player: PlayerRecord;
  guildIds: Set<number>;
};

export class InterchatGuild {
  private state: DurableObjectState;
  private env: Env;
  private sockets = new Set<WebSocket>();
  private socketMeta = new Map<WebSocket, SocketMeta>();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/api\/guilds\/(\d+)\/stream$/);
    const isUserStream = url.pathname === "/api/stream";
    const guildId = match ? Number(match[1]) : Number.NaN;

    if (!match && !isUserStream) {
      if (url.pathname === "/internal/broadcast") {
        const body = (await request.json().catch(() => null)) as
          | {messages?: Array<Record<string, unknown>>}
          | null;
        if (!body?.messages || !Array.isArray(body.messages)) {
          return new Response("Invalid payload", {status: 400});
        }
        for (const message of body.messages) {
          const guildValue = Number(message.guild_id);
          if (!Number.isFinite(guildValue)) continue;
          const payload = JSON.stringify(message);
          for (const ws of this.sockets) {
            try {
              const wsMeta = this.socketMeta.get(ws);
              if (!wsMeta?.guildIds.has(guildValue)) continue;
              ws.send(payload);
            } catch {
              this.sockets.delete(ws);
              this.socketMeta.delete(ws);
            }
          }
        }
        return new Response("OK");
      }
      return new Response("Invalid guild", {status: 400});
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

    if (!token) {
      console.log("DO: missing token or invalid guild", {
        guildId,
        hasToken: !!token,
      });
      return new Response("Unauthorized", {status: 401});
    }

    const player = await this.getPlayer(token);
    if (!player) {
      console.log("DO: token not found in interchat_players", {
        guildId,
      });
      return new Response("Unauthorized", {status: 401});
    }
    let guildIds = new Set<number>();
    if (!Number.isNaN(guildId)) {
      const isMember = await this.checkMembership(player.uuid, guildId);
      if (!isMember) {
        console.log("DO: membership check failed", {
          guildId,
          uuid: player.uuid,
        });
        return new Response("Forbidden", {status: 403});
      }
      guildIds = new Set([guildId]);
    } else {
      guildIds = await this.fetchMemberships(player.uuid, null);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    this.sockets.add(server);
    this.socketMeta.set(server, {player, guildIds});

    server.addEventListener("message", (event) => {
      this.handleMessage(server, event);
    });
    server.addEventListener("close", () => {
      this.sockets.delete(server);
      this.socketMeta.delete(server);
    });
    server.addEventListener("error", () => {
      this.sockets.delete(server);
      this.socketMeta.delete(server);
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
    return null;
  }

  private async handleMessage(socket: WebSocket, event: MessageEvent) {
    const meta = this.socketMeta.get(socket);
    if (!meta) return;
    const data = typeof event.data === "string" ? event.data : "";
    if (!data) return;
    let parsed:
      | {type?: string; guildId?: number; message?: string}
      | {type?: string; guildIds?: number[]}
      | null = null;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }
    if (!parsed) return;

    if (parsed.type === "subscribe") {
      const next =
        "guildIds" in parsed && Array.isArray(parsed.guildIds) ? parsed.guildIds : [];
      const filtered = await this.fetchMemberships(meta.player.uuid, next);
      meta.guildIds = filtered;
      return;
    }

    if (parsed.type !== "message") return;
    if (
      !("message" in parsed) ||
      !("guildId" in parsed) ||
      typeof parsed.message !== "string" ||
      !Number.isFinite(parsed.guildId)
    ) {
      return;
    }
    if (!meta.guildIds.has(parsed.guildId!)) return;
    const stillMember = await this.checkMembership(meta.player.uuid, parsed.guildId!);
    if (!stillMember) {
      meta.guildIds.delete(parsed.guildId!);
      return;
    }

    const timestamp = Date.now();
    const insertResult = await this.env.interchat
      .prepare(
        "INSERT INTO guild_messages (guild_id, server, sender, message, transliterated_message, `timestamp`) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .bind(parsed.guildId!, "Web", meta.player.uuid, parsed.message, null, timestamp)
      .run();
    const id = insertResult.meta?.last_row_id ?? undefined;

    const payload = JSON.stringify({
      type: "guild_message",
      id,
      guild_id: parsed.guildId!,
      server: "Web",
      sender: meta.player.uuid,
      message: parsed.message,
      transliterated_message: null,
      timestamp,
    });

    for (const ws of this.sockets) {
      try {
        const wsMeta = this.socketMeta.get(ws);
        if (!wsMeta?.guildIds.has(parsed.guildId!)) continue;
        ws.send(payload);
      } catch {
        this.sockets.delete(ws);
        this.socketMeta.delete(ws);
      }
    }
  }

  private async checkMembership(uuid: string, guildId: number) {
    const cacheKey = `member:${uuid}:${guildId}`;
    const cached = await this.state.storage.get<MembershipCache>(cacheKey);
    const now = Date.now();
    if (cached && now - cached.ts < MEMBERSHIP_CACHE_MS) {
      return cached.ok;
    }

    const result = await this.env.interchat
      .prepare("SELECT 1 FROM guild_members WHERE guild_id = ? AND uuid = ?")
      .bind(guildId, uuid)
      .all<{1: number}>();
    const ok = (result.results?.length ?? 0) > 0;
    await this.state.storage.put(cacheKey, {ok, ts: now});
    return ok;
  }

  private async fetchMemberships(uuid: string, guildIds: number[] | null) {
    if (!guildIds) {
      const result = await this.env.interchat
        .prepare("SELECT guild_id FROM guild_members WHERE uuid = ?")
        .bind(uuid)
        .all<{guild_id: number}>();
      return new Set((result.results ?? []).map((row) => row.guild_id));
    }
    const requested = guildIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
    if (requested.length === 0) {
      return new Set<number>();
    }
    const placeholders = requested.map(() => "?").join(", ");
    const result = await this.env.interchat
      .prepare(
        `SELECT guild_id FROM guild_members WHERE uuid = ? AND guild_id IN (${placeholders})`
      )
      .bind(uuid, ...requested)
      .all<{guild_id: number}>();
    return new Set((result.results ?? []).map((row) => row.guild_id));
  }
}

const handler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const streamMatch = url.pathname.match(/^\/api\/guilds\/(\d+)\/stream$/);
    if (streamMatch || url.pathname === "/api/stream") {
      const id = env.INTERCHAT_GUILD.idFromName("global");
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
