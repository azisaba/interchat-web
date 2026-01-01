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
    const unsubscribe = subscribe(() => {
      setCounts(getUnreadCounts());
    });
    return unsubscribe;
  }, []);

  return counts;
}

export function useInterchatMessages(guildId: number) {
  const [messages, setMessages] = useState<InterChatGuildMessage[]>(() =>
    getMessagesForGuild(guildId)
  );

  useEffect(() => {
    setMessages(getMessagesForGuild(guildId));
    const unsubscribe = subscribe(() => {
      setMessages(getMessagesForGuild(guildId));
    });
    return unsubscribe;
  }, [guildId]);

  return messages;
}

export function markGuildRead(guildId: number) {
  clearUnread(guildId);
}
