"use client";

import {useParams} from "next/navigation";
import {useEffect, useMemo, useRef, useState} from "react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import useWebsocketWorker from "@/hooks/use-websocket-worker";
import {markGuildRead, useInterchatMessages} from "@/hooks/use-interchat-store";
import {useGuildMembers} from "@/hooks/use-azisaba";
import {prependMessagesForGuild, setMessagesForGuild} from "@/lib/interchat-store";
import useLocalStorage from "@/hooks/use-local-storage";
import {renderChatColors, renderChatMessage} from "@/util/chat-color";

export default function GuildChatPage() {
  const params = useParams();
  const guildId = useMemo(() => {
    const raw = params.id;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return Number(value);
  }, [params.id]);
  const messages = useInterchatMessages(guildId);
  const {state, send} = useWebsocketWorker();
  const [token] = useLocalStorage("token");
  const [draft, setDraft] = useState("");
  const members = useGuildMembers(guildId);
  const listRef = useRef<HTMLDivElement | null>(null);
  const loadedHistoryRef = useRef(new Set<number>());
  const [loadingOlderByGuild, setLoadingOlderByGuild] = useState<Record<number, boolean>>({});
  const [hasMoreByGuild, setHasMoreByGuild] = useState<Record<number, boolean>>({});
  const loadingOlder = loadingOlderByGuild[guildId] ?? false;
  const hasMore = hasMoreByGuild[guildId] ?? true;

  const resolveMemberName = (uuid: string) => {
    const member = members.find(m => m.uuid === uuid);
    if (!member) {
      return uuid;
    }
    return renderChatColors(member.nickname ?? member.name)
  }

  const resolveTimestamp = (timestamp?: number) => {
    if (!timestamp) return null;
    return " • " + new Date(timestamp).toLocaleString("ja-JP", {})
  }

  useEffect(() => {
    if (Number.isNaN(guildId)) return;
    markGuildRead(guildId);
  }, [guildId]);

  useEffect(() => {
    if (Number.isNaN(guildId)) return;
    if (!token || token === "null") return;
    if (loadedHistoryRef.current.has(guildId)) return;
    if (messages.length > 0) {
      loadedHistoryRef.current.add(guildId);
      return;
    }
    loadedHistoryRef.current.add(guildId);
    fetch(`/api/messages?guildId=${guildId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Unable to load messages (${res.status})`);
        }
        return (await res.json()) as Array<{
          id: number;
          guild_id: number;
          server: string;
          sender: string;
          message: string;
          transliterated_message: string | null;
          timestamp: number;
        }>;
      })
      .then((rows) => {
        const mapped = rows.map((row) => ({
          type: "guild_message" as const,
          id: row.id,
          guild_id: row.guild_id,
          server: row.server,
          sender: row.sender,
          message: row.message,
          transliterated_message: row.transliterated_message,
          timestamp: row.timestamp,
        }));
        console.log(mapped)
        setMessagesForGuild(guildId, mapped);
        if (rows.length < 50) {
          setHasMoreByGuild((prev) => ({...prev, [guildId]: false}));
        }
      })
      .catch((e) => {
        console.error(e)
        loadedHistoryRef.current.delete(guildId);
      });
  }, [guildId, token, messages.length]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  const canSend = state === "open";

  const sendMessage = () => {
    const trimmed = draft.trim();
    if (!trimmed || Number.isNaN(guildId)) return;
    send(JSON.stringify({type: "message", guildId, message: trimmed}));
    setDraft("");
  };

  const loadOlder = () => {
    if (loadingOlder || !hasMore) return;
    if (!token || token === "null") return;
    const oldestId = messages
      .map((message) => message.id)
      .filter((id): id is number => id !== undefined)
      .reduce((min, id) => Math.min(min, id), Number.POSITIVE_INFINITY);
    if (!Number.isFinite(oldestId)) {
      setHasMoreByGuild((prev) => ({...prev, [guildId]: false}));
      return;
    }
    setLoadingOlderByGuild((prev) => ({...prev, [guildId]: true}));
    fetch(`/api/messages?guildId=${guildId}&beforeId=${oldestId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Unable to load messages (${res.status})`);
        }
        return (await res.json()) as Array<{
          id: number;
          guild_id: number;
          server: string;
          sender: string;
          message: string;
          transliterated_message: string | null;
          timestamp: number;
        }>;
      })
      .then((rows) => {
        const mapped = rows.map((row) => ({
          type: "guild_message" as const,
          id: row.id,
          guild_id: row.guild_id,
          server: row.server,
          sender: row.sender,
          message: row.message,
          transliterated_message: row.transliterated_message,
          timestamp: row.timestamp,
        }));
        prependMessagesForGuild(guildId, mapped);
        if (rows.length < 50) {
          setHasMoreByGuild((prev) => ({...prev, [guildId]: false}));
        }
      })
      .finally(() => {
        setLoadingOlderByGuild((prev) => ({...prev, [guildId]: false}));
      });
  };

  if (Number.isNaN(guildId)) {
    return <p>Invalid guild.</p>;
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">ギルド {guildId}</h1>
        <span className="text-xs text-muted-foreground">
          {canSend ? "Connected" : "Disconnected"}
        </span>
      </div>
      <div
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto rounded-md border bg-background p-3"
      >
        <div className="flex justify-center">
          <Button
            type="button"
            variant="secondary"
            disabled={loadingOlder || !hasMore}
            onClick={loadOlder}
          >
            {hasMore ? (loadingOlder ? "読み込み中..." : "過去のメッセージを読み込む") : "これ以上ありません"}
          </Button>
        </div>
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">まだメッセージがありません...</p>
        ) : (
          messages.map((message, index) => (
            <div key={`${message.guild_id}-${index}`} className="rounded-md border px-3 py-2">
              <div className="text-xs text-muted-foreground">
                {resolveMemberName(message.sender)}@{message.server}{resolveTimestamp(message.timestamp)}
              </div>
              <div className="whitespace-pre-wrap">{renderChatMessage(message.message)}</div>
              {message.transliterated_message ? (
                <div className="text-xs italic text-muted-foreground">
                  {message.transliterated_message}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage();
        }}
      >
        <Input
          placeholder={canSend ? "メッセージを入力..." : "接続中..."}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={!canSend}
        />
        <Button type="submit" disabled={!canSend || draft.trim().length === 0}>
          送信
        </Button>
      </form>
    </div>
  );
}
