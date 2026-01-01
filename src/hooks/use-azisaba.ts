"use client";

import useLocalStorage from "@/hooks/use-local-storage";
import {AzisabaPlayer, InterChatGuild, InterChatGuildMember} from "@/types";
import {useEffect, useState} from "react";
import {get} from "@/util/api";

export function useSelfUser(): AzisabaPlayer | null {
  const [user, setUser] = useState<AzisabaPlayer | null>(null);
  const [token] = useLocalStorage("token");
  useEffect(() => {
    get("https://api-ktor.azisaba.net/players/me").then(res => {
      setUser(res as AzisabaPlayer);
    }).catch(() => {
      setUser(null);
    });
  }, [token]);
  return user;
}

export function useGuildList(): InterChatGuild[] {
  const [guildList, setGuildList] = useState(new Array<InterChatGuild>());
  const [token] = useLocalStorage("token");
  useEffect(() => {
    get("https://api-ktor.azisaba.net/interchat/guilds/list").then(res => {
      setGuildList(res as Array<InterChatGuild>);
    }).catch(() => {
      setGuildList([])
    });
  }, [token]);
  return guildList;
}

export function useGuildMembers(guildId: number) {
  const [members, setMembers] = useState<Array<InterChatGuildMember>>([]);
  const [token] = useLocalStorage("token");
  useEffect(() => {
    get(`https://api-ktor.azisaba.net/interchat/guilds/${guildId}/members`).then(res => {
      setMembers(res as Array<InterChatGuildMember>);
    }).catch(() => {
      setMembers([])
    })
  }, [guildId, token]);
  return members;
}
