"use client";

import {useEffect} from "react";
import useLocalStorage from "@/hooks/use-local-storage";
import {appendMessage, clearUnread, incrementUnread} from "@/lib/interchat-store";
import type {InterChatGuildMessage} from "@/types";

type ConnectionState = {
  ws: WebSocket | null;
  token: string | null;
  refCount: number;
  reconnectAttempt: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
};

const connections = new Map<number, ConnectionState>();
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 15000;
let activeGuildId: number | null = null;

function buildWsUrl(path: string) {
  if (typeof window === "undefined") return path;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}${path}`;
}

function encodeBase64Url(value: string) {
  const encoded = btoa(value);
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function getConnection(guildId: number) {
  const existing = connections.get(guildId);
  if (existing) return existing;
  const created: ConnectionState = {
    ws: null,
    token: null,
    refCount: 0,
    reconnectAttempt: 0,
    reconnectTimer: null,
  };
  connections.set(guildId, created);
  return created;
}

function scheduleReconnect(guildId: number) {
  const connection = getConnection(guildId);
  if (connection.reconnectTimer) return;
  const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** connection.reconnectAttempt);
  connection.reconnectAttempt = Math.min(connection.reconnectAttempt + 1, 10);
  connection.reconnectTimer = setTimeout(() => {
    connection.reconnectTimer = null;
    connect(guildId);
  }, delay);
}

function connect(guildId: number) {
  const connection = getConnection(guildId);
  if (!connection.token) return;
  if (connection.ws && connection.ws.readyState === WebSocket.OPEN) return;
  if (connection.ws && connection.ws.readyState === WebSocket.CONNECTING) return;

  connection.ws?.close();
  const url = buildWsUrl(`/api/guilds/${guildId}/stream`);
  const token = connection.token ?? "";
  const encodedToken = typeof btoa === "function" ? encodeBase64Url(token) : token;
  const ws = new WebSocket(url, ["bearer-b64", encodedToken]);
  connection.ws = ws;

  ws.onmessage = (event) => {
    if (typeof event.data !== "string") return;
    let parsed: InterChatGuildMessage | null = null;
    try {
      parsed = JSON.parse(event.data) as InterChatGuildMessage;
    } catch {
      return;
    }
    if (!parsed || parsed.type !== "guild_message") return;
    appendMessage(parsed);
    if (activeGuildId !== null && parsed.guild_id === activeGuildId) {
      clearUnread(parsed.guild_id);
    } else {
      incrementUnread(parsed.guild_id);
    }
  };

  ws.onopen = () => {
    connection.reconnectAttempt = 0;
  };

  ws.onclose = () => {
    if (!connection.token || connection.refCount === 0) return;
    scheduleReconnect(guildId);
  };

  ws.onerror = () => {
    if (!connection.token || connection.refCount === 0) return;
    scheduleReconnect(guildId);
  };
}

function ensureConnection(guildId: number, token: string | null) {
  const connection = getConnection(guildId);
    if (!token || token === "null") {
      connection.token = null;
      connection.ws?.close();
      connection.ws = null;
      return;
    }
    if (connection.token !== token) {
      connection.token = token;
      connection.ws?.close();
      connection.ws = null;
    }
    connect(guildId);
}

function retain(guildId: number) {
  const connection = getConnection(guildId);
  connection.refCount += 1;
}

function release(guildId: number) {
  const connection = getConnection(guildId);
  connection.refCount = Math.max(0, connection.refCount - 1);
  if (connection.refCount === 0) {
    connection.ws?.close();
    connection.ws = null;
    if (connection.reconnectTimer) {
      clearTimeout(connection.reconnectTimer);
      connection.reconnectTimer = null;
    }
    connections.delete(guildId);
  }
}

export default function useGuildDurableStream(guildId: number) {
  const [token] = useLocalStorage("token");

  useEffect(() => {
    if (Number.isNaN(guildId)) return;
    retain(guildId);
    return () => release(guildId);
  }, [guildId]);

  useEffect(() => {
    if (Number.isNaN(guildId)) return;
    ensureConnection(guildId, token);
  }, [guildId, token]);

  const sendToDurableObject = (payload: unknown) => {
    if (Number.isNaN(guildId)) return;
    const connection = getConnection(guildId);
    if (!connection.ws || connection.ws.readyState !== WebSocket.OPEN) return;
    connection.ws.send(JSON.stringify(payload));
  };

  return {sendToDurableObject} as const;
}

export function setActiveGuildId(next: number | null) {
  activeGuildId = next;
}
