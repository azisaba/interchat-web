"use client";

import {useEffect, useState} from "react";
import useLocalStorage from "@/hooks/use-local-storage";
import {appendMessage, clearUnread, incrementUnread} from "@/lib/interchat-store";
import type {InterChatGuildMessage} from "@/types";

type ConnectionState = {
  ws: WebSocket | null;
  token: string | null;
  refCount: number;
  reconnectAttempt: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  status: "idle" | "connecting" | "open" | "closed" | "error";
  desiredGuildIds: number[];
  listeners: Set<(status: ConnectionState["status"]) => void>;
};

const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 15000;
let activeGuildId: number | null = null;
const connection: ConnectionState = {
  ws: null,
  token: null,
  refCount: 0,
  reconnectAttempt: 0,
  reconnectTimer: null,
  status: "idle",
  desiredGuildIds: [],
  listeners: new Set(),
};

function buildWsUrl(path: string) {
  if (typeof window === "undefined") return path;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}${path}`;
}

function encodeBase64Url(value: string) {
  const encoded = btoa(value);
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function getConnection() {
  return connection;
}

function notifyStatus(connection: ConnectionState) {
  for (const listener of connection.listeners) {
    listener(connection.status);
  }
}

function scheduleReconnect() {
  const connection = getConnection();
  if (connection.reconnectTimer) return;
  const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** connection.reconnectAttempt);
  connection.reconnectAttempt = Math.min(connection.reconnectAttempt + 1, 10);
  connection.reconnectTimer = setTimeout(() => {
    connection.reconnectTimer = null;
    connect();
  }, delay);
}

function connect() {
  const connection = getConnection();
  if (!connection.token) return;
  if (connection.ws && connection.ws.readyState === WebSocket.OPEN) return;
  if (connection.ws && connection.ws.readyState === WebSocket.CONNECTING) return;

  connection.ws?.close();
  connection.status = "connecting";
  notifyStatus(connection);
  const url = buildWsUrl("/api/stream");
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
    connection.status = "open";
    notifyStatus(connection);
    sendSubscriptions();
  };

  ws.onclose = () => {
    connection.status = "closed";
    notifyStatus(connection);
    if (!connection.token || connection.refCount === 0) return;
    scheduleReconnect();
  };

  ws.onerror = () => {
    connection.status = "error";
    notifyStatus(connection);
    if (!connection.token || connection.refCount === 0) return;
    scheduleReconnect();
  };
}

function ensureConnection(token: string | null) {
  const connection = getConnection();
  if (!token || token === "null") {
    connection.token = null;
    connection.ws?.close();
    connection.ws = null;
    connection.status = "closed";
    notifyStatus(connection);
    return;
  }
  if (connection.token !== token) {
    connection.token = token;
    connection.ws?.close();
    connection.ws = null;
  }
  connect();
}

function retain() {
  const connection = getConnection();
  connection.refCount += 1;
}

function release() {
  const connection = getConnection();
  connection.refCount = Math.max(0, connection.refCount - 1);
  if (connection.refCount === 0) {
    connection.ws?.close();
    connection.ws = null;
    if (connection.reconnectTimer) {
      clearTimeout(connection.reconnectTimer);
      connection.reconnectTimer = null;
    }
  }
}

function normalizeGuildIds(guildIds: number[]) {
  const normalized = guildIds
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
  return Array.from(new Set(normalized)).sort((a, b) => a - b);
}

function sameIds(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function sendSubscriptions() {
  const connection = getConnection();
  if (!connection.ws || connection.ws.readyState !== WebSocket.OPEN) return;
  connection.ws.send(
    JSON.stringify({type: "subscribe", guildIds: connection.desiredGuildIds})
  );
}

function updateSubscriptions(guildIds: number[]) {
  const connection = getConnection();
  const normalized = normalizeGuildIds(guildIds);
  if (sameIds(connection.desiredGuildIds, normalized)) return;
  connection.desiredGuildIds = normalized;
  sendSubscriptions();
}

export default function useGuildDurableStream(guildIds?: number[]) {
  const [token] = useLocalStorage("token");
  const [status, setStatus] = useState<ConnectionState["status"]>("idle");

  useEffect(() => {
    const connection = getConnection();
    connection.listeners.add(setStatus);
    setStatus(connection.status);
    retain();
    return () => {
      connection.listeners.delete(setStatus);
      release();
    };
  }, []);

  useEffect(() => {
    ensureConnection(token);
  }, [token]);

  useEffect(() => {
    if (!guildIds) return;
    updateSubscriptions(guildIds);
  }, [guildIds]);

  const sendToDurableObject = (payload: unknown) => {
    const connection = getConnection();
    if (!connection.ws || connection.ws.readyState !== WebSocket.OPEN) return;
    connection.ws.send(JSON.stringify(payload));
  };

  return {sendToDurableObject, status} as const;
}

export function setActiveGuildId(next: number | null) {
  activeGuildId = next;
}
