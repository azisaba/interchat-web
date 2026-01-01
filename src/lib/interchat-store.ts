import type {InterChatGuildMessage} from "@/types";

type StoreState = {
  messagesByGuild: Record<number, InterChatGuildMessage[]>;
  unreadByGuild: Record<number, number>;
};

type Listener = () => void;

const MAX_MESSAGES_PER_GUILD = 200;
const listeners = new Set<Listener>();
let hasLoadedUnread = false;

let state: StoreState = {
  messagesByGuild: {},
  unreadByGuild: {},
};

function emit() {
  listeners.forEach((listener) => listener());
}

function persistUnread() {
  if (typeof window === "undefined") return;
  localStorage.setItem("unreadCounts", JSON.stringify(state.unreadByGuild));
  window.dispatchEvent(new Event("storage"));
}

export function ensureUnreadLoaded() {
  if (hasLoadedUnread || typeof window === "undefined") return;
  const raw = localStorage.getItem("unreadCounts");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, number>;
      state = {
        ...state,
        unreadByGuild: Object.fromEntries(
          Object.entries(parsed).map(([key, value]) => [Number(key), Number(value)])
        ),
      };
    } catch {
      state = {...state, unreadByGuild: {}};
    }
  }
  hasLoadedUnread = true;
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getUnreadCounts() {
  return state.unreadByGuild;
}

export function getMessagesForGuild(guildId: number) {
  return state.messagesByGuild[guildId] ?? [];
}

export function setMessagesForGuild(guildId: number, messages: InterChatGuildMessage[]) {
  state = {
    ...state,
    messagesByGuild: {
      ...state.messagesByGuild,
      [guildId]: messages.slice(-MAX_MESSAGES_PER_GUILD),
    },
  };
  emit();
}

export function prependMessagesForGuild(
  guildId: number,
  olderMessages: InterChatGuildMessage[]
) {
  if (olderMessages.length === 0) return;
  const existing = state.messagesByGuild[guildId] ?? [];
  const existingIds = new Set(existing.map((message) => message.id).filter(Boolean));
  const filtered = olderMessages.filter((message) => {
    if (message.id === undefined) return true;
    return !existingIds.has(message.id);
  });
  const nextMessages = [...filtered, ...existing].slice(-MAX_MESSAGES_PER_GUILD);
  state = {
    ...state,
    messagesByGuild: {
      ...state.messagesByGuild,
      [guildId]: nextMessages,
    },
  };
  emit();
}

export function appendMessage(message: InterChatGuildMessage) {
  const existing = state.messagesByGuild[message.guild_id] ?? [];
  const nextMessages = [...existing, message].slice(-MAX_MESSAGES_PER_GUILD);
  state = {
    ...state,
    messagesByGuild: {
      ...state.messagesByGuild,
      [message.guild_id]: nextMessages,
    },
  };
  emit();
}

export function incrementUnread(guildId: number) {
  ensureUnreadLoaded();
  const current = state.unreadByGuild[guildId] ?? 0;
  state = {
    ...state,
    unreadByGuild: {
      ...state.unreadByGuild,
      [guildId]: current + 1,
    },
  };
  persistUnread();
  emit();
}

export function clearUnread(guildId: number) {
  ensureUnreadLoaded();
  if (!(guildId in state.unreadByGuild)) return;
  const next = {...state.unreadByGuild};
  delete next[guildId];
  state = {
    ...state,
    unreadByGuild: next,
  };
  persistUnread();
  emit();
}
