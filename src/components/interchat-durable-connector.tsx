"use client";

import {useMemo, useEffect} from "react";
import {usePathname} from "next/navigation";
import {useGuildList} from "@/hooks/use-azisaba";
import useGuildDurableStream, {setActiveGuildId} from "@/hooks/use-guild-durable-stream";

export default function InterchatDurableConnector() {
  const guildList = useGuildList();
  const pathname = usePathname();
  const guildIds = useMemo(() => guildList.map((guild) => guild.id), [guildList]);

  const activeId = useMemo(() => {
    const match = pathname.match(/^\/guilds\/(\d+)/);
    if (!match) return null;
    const id = Number(match[1]);
    return Number.isNaN(id) ? null : id;
  }, [pathname]);

  useEffect(() => {
    setActiveGuildId(activeId);
  }, [activeId]);

  useGuildDurableStream(guildIds);

  return null;
}
