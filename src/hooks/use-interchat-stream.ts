"use client";

import {useCallback, useEffect, useMemo, useRef} from "react";
import {usePathname} from "next/navigation";
import type {InterChatGuildMessage} from "@/types";
import useLocalStorage from "@/hooks/use-local-storage";
import useWebsocketWorker from "@/hooks/use-websocket-worker";
import {appendMessage, clearUnread, incrementUnread} from "@/lib/interchat-store";

const STREAM_URL = "wss://api-ktor.azisaba.net/interchat/stream/web?server=Web";
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const JITTER_MS = 500;

export default function useInterchatStream() {
  const [token] = useLocalStorage("token");
  const {state, lastMessage, lastClose, connect, send, close} = useWebsocketWorker();
  const pathname = usePathname();
  const lastAuthedTokenRef = useRef<string | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  const activeGuildIdRef = useRef<number | null>(null);
  const lastHandledMessageRef = useRef<string | null>(null);

  const normalizedToken = useMemo(() => {
    if (!token || token === "null") return null;
    return token;
  }, [token]);

  const activeGuildId = useMemo(() => {
    const match = pathname.match(/^\/guilds\/(\d+)/);
    if (!match) return null;
    const id = Number(match[1]);
    return Number.isNaN(id) ? null : id;
  }, [pathname]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!normalizedToken || reconnectTimerRef.current !== null) return;
    const attempt = reconnectAttemptRef.current;
    const jitter = Math.floor(Math.random() * JITTER_MS);
    const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt + jitter);
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      reconnectAttemptRef.current = Math.min(reconnectAttemptRef.current + 1, 10);
      if (stateRef.current !== "open" && stateRef.current !== "connecting") {
        lastAuthedTokenRef.current = normalizedToken;
        connect(STREAM_URL, [JSON.stringify({type: "auth", key: normalizedToken})]);
      }
    }, delay);
  }, [normalizedToken, connect]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    activeGuildIdRef.current = activeGuildId;
  }, [activeGuildId]);

  useEffect(() => {
    if (!normalizedToken) {
      lastAuthedTokenRef.current = null;
      reconnectAttemptRef.current = 0;
      clearReconnectTimer();
      close();
      return;
    }
    if (stateRef.current !== "open" && stateRef.current !== "connecting") {
      lastAuthedTokenRef.current = normalizedToken;
      connect(STREAM_URL, [JSON.stringify({type: "auth", key: normalizedToken})]);
    }
  }, [normalizedToken, connect, clearReconnectTimer, close]);

  useEffect(() => {
    if (!normalizedToken) return;
    if (state === "open") {
      reconnectAttemptRef.current = 0;
      clearReconnectTimer();
    } else if (state === "closed" || state === "error") {
      lastAuthedTokenRef.current = null;
      scheduleReconnect();
    }
  }, [normalizedToken, state, scheduleReconnect, clearReconnectTimer]);

  useEffect(() => {
    if (!lastClose) return;
    console.warn("InterChat WS closed", lastClose.code, lastClose.reason);
  }, [lastClose]);

  useEffect(() => {
    if (!normalizedToken || state !== "open") {
      return;
    }
    if (lastAuthedTokenRef.current === normalizedToken) {
      return;
    }
    send(JSON.stringify({type: "auth", key: normalizedToken}));
    lastAuthedTokenRef.current = normalizedToken;
  }, [normalizedToken, state, send]);

  useEffect(() => {
    if (!lastMessage || lastHandledMessageRef.current === lastMessage) return;
    let parsed: InterChatGuildMessage | null = null;
    try {
      parsed = JSON.parse(lastMessage) as InterChatGuildMessage;
    } catch {
      return;
    }
    if (!parsed || parsed.type !== "guild_message") {
      return;
    }
    parsed.timestamp = Date.now();
    lastHandledMessageRef.current = lastMessage;
    appendMessage(parsed);
    const currentGuildId = activeGuildIdRef.current;
    if (currentGuildId !== null && parsed.guild_id === currentGuildId) {
      clearUnread(parsed.guild_id);
    } else {
      incrementUnread(parsed.guild_id);
    }
  }, [lastMessage]);
}
