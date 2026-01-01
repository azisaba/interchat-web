"use client";

import {useSyncExternalStore} from "react";
import type {InterChatGuildMessage} from "@/types";
import {
  clearUnread,
  ensureUnreadLoaded,
  getMessagesForGuild,
  getUnreadCounts,
  subscribe,
} from "@/lib/interchat-store";

export function useInterchatUnreadCounts() {
  ensureUnreadLoaded();
  return useSyncExternalStore(
    subscribe,
    () => getUnreadCounts(),
    () => getUnreadCounts()
  );
}

export function useInterchatMessages(guildId: number) {
  return useSyncExternalStore(
    subscribe,
    () => getMessagesForGuild(guildId),
    () => getMessagesForGuild(guildId)
  ) as InterChatGuildMessage[];
}

export function markGuildRead(guildId: number) {
  clearUnread(guildId);
}
