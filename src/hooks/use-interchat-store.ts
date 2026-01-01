"use client";

import {useEffect, useState} from "react";
import type {InterChatGuildMessage} from "@/types";
import {
  clearUnread,
  ensureUnreadLoaded,
  getMessagesForGuild,
  getUnreadCounts,
  subscribe,
} from "@/lib/interchat-store";

export function useInterchatUnreadCounts() {
  const [counts, setCounts] = useState<Record<number, number>>(() => {
    ensureUnreadLoaded();
    return getUnreadCounts();
  });

  useEffect(() => {
    ensureUnreadLoaded();
    return () => {
      subscribe(() => {
        setCounts(getUnreadCounts());
      });
    }
  }, []);

  return counts;
}

export function useInterchatMessages(guildId: number) {
  const [messages, setMessages] = useState<InterChatGuildMessage[]>(() =>
    getMessagesForGuild(guildId)
  );

  useEffect(() => {
    setMessages(getMessagesForGuild(guildId));
    return () => {
      subscribe(() => {
        setMessages(getMessagesForGuild(guildId));
      });
    }
  }, [guildId]);

  return messages;
}

export function markGuildRead(guildId: number) {
  clearUnread(guildId);
}
