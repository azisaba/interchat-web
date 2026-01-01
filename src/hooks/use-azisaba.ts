"use client";

import useLocalStorage from "@/hooks/use-local-storage";
import {InterChatGuild, InterChatGuildMember, InterChatPlayer} from "@/types";
import {useEffect, useState} from "react";
import {get} from "@/util/api";

export function useSelfUser(): InterChatPlayer | null {
  const [user, setUser] = useState<InterChatPlayer | null>(null);
  const [token] = useLocalStorage("token");
  useEffect(() => {
    if (!token || token === "null") {
      Promise.resolve().then(() => setUser(null));
      return;
    }
    get("/api/self")
      .then(res => {
        setUser(res as InterChatPlayer);
      })
      .catch(() => {
        setUser(null);
      });
  }, [token]);
  return user;
}

export function useGuildList(): InterChatGuild[] {
  const [guildList, setGuildList] = useState(() => {
    if (typeof window === "undefined") return [];
    const cached = localStorage.getItem("guildListCache");
    const ts = Number(localStorage.getItem("guildListCacheTs"));
    if (cached && Number.isFinite(ts) && Date.now() - ts <= 30 * 60 * 1000) {
      try {
        return JSON.parse(cached) as InterChatGuild[];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [token] = useLocalStorage("token");
  useEffect(() => {
    if (!token || token === "null") {
      Promise.resolve().then(() => setGuildList([]));
      return;
    }
    get("/api/guilds/list")
      .then(res => {
        const list = res as Array<InterChatGuild>;
        localStorage.setItem("guildListCache", JSON.stringify(list));
        localStorage.setItem("guildListCacheTs", Date.now().toString());
        setGuildList(list);
      })
      .catch(() => {
        const cached = localStorage.getItem("guildListCache");
        const ts = Number(localStorage.getItem("guildListCacheTs"));
        if (cached && Number.isFinite(ts) && Date.now() - ts <= 30 * 60 * 1000) {
          try {
            setGuildList(JSON.parse(cached) as InterChatGuild[]);
            return;
          } catch {
            // fall through
          }
        }
        setGuildList([]);
      });
  }, [token]);
  return guildList;
}

export function useGuildMembers(guildId: number) {
  const [members, setMembers] = useState<Array<InterChatGuildMember>>(() => {
    if (typeof window === "undefined") return [];
    const cacheKey = `guildMembersCache:${guildId}`;
    const tsKey = `guildMembersCacheTs:${guildId}`;
    const cached = localStorage.getItem(cacheKey);
    const ts = Number(localStorage.getItem(tsKey));
    if (cached && Number.isFinite(ts) && Date.now() - ts <= 30 * 60 * 1000) {
      try {
        return JSON.parse(cached) as InterChatGuildMember[];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [token] = useLocalStorage("token");
  useEffect(() => {
    if (!token || token === "null") {
      Promise.resolve().then(() => setMembers([]));
      return;
    }
    const cacheKey = `guildMembersCache:${guildId}`;
    const tsKey = `guildMembersCacheTs:${guildId}`;
    get(`/api/guilds/${guildId}/members`)
      .then(res => {
        const list = res as Array<InterChatGuildMember>;
        localStorage.setItem(cacheKey, JSON.stringify(list));
        localStorage.setItem(tsKey, Date.now().toString());
        setMembers(list);
      })
      .catch(() => {
        const cached = localStorage.getItem(cacheKey);
        const ts = Number(localStorage.getItem(tsKey));
        if (cached && Number.isFinite(ts) && Date.now() - ts <= 30 * 60 * 1000) {
          try {
            setMembers(JSON.parse(cached) as Array<InterChatGuildMember>);
            return;
          } catch {
            // fall through
          }
        }
        setMembers([]);
      });
  }, [guildId, token]);
  return members;
}
