"use client";

import {useMemo, useEffect} from "react";
import {usePathname} from "next/navigation";
import {useGuildList} from "@/hooks/use-azisaba";
import useGuildDurableStream, {setActiveGuildId} from "@/hooks/use-guild-durable-stream";

function GuildDurableStreamItem({guildId}: {guildId: number}) {
  useGuildDurableStream(guildId);
  return null;
}

export default function InterchatDurableConnector() {
  const guildList = useGuildList();
  const pathname = usePathname();

  const activeId = useMemo(() => {
    const match = pathname.match(/^\/guilds\/(\d+)/);
    if (!match) return null;
    const id = Number(match[1]);
    return Number.isNaN(id) ? null : id;
  }, [pathname]);

  useEffect(() => {
    setActiveGuildId(activeId);
  }, [activeId]);

  return (
    <>
      {guildList.map((guild) => (
        <GuildDurableStreamItem key={guild.id} guildId={guild.id} />
      ))}
    </>
  );
}
