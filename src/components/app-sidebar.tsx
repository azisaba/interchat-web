"use client";

import {usePathname} from "next/navigation";
import {
  Sidebar,
  SidebarContent, SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar";
import {HomeIcon, MessageSquare} from 'lucide-react'
import Link from "next/link";
import NavUser from "@/components/nav-user";
import {useGuildList} from "@/hooks/use-azisaba";
import {markGuildRead, useInterchatUnreadCounts} from "@/hooks/use-interchat-store";
import {useEffect, useMemo} from "react";

export default function AppSidebar() {
  const pathname = usePathname();
  const guildList = useGuildList();
  const unreadCounts = useInterchatUnreadCounts();

  const activeGuildId = useMemo(() => {
    const match = pathname.match(/^\/guilds\/(\d+)/);
    if (!match) return null;
    const id = Number(match[1]);
    return Number.isNaN(id) ? null : id;
  }, [pathname]);

  useEffect(() => {
    if (activeGuildId === null) return;
    markGuildRead(activeGuildId);
  }, [activeGuildId]);

  // Helper function to check for an active link
  const isActive = ({
                      url,
                      startsWith = false,
                    }: {
    url: string;
    startsWith?: boolean;
  }): boolean => {
    if (startsWith) {
      return pathname.startsWith(url);
    } else {
      return pathname === url;
    }
  };

  const guildElements = guildList.map((guild) => {
    const url = `/guilds/${guild.id}`
    const unreadCount = unreadCounts[guild.id] ?? 0;
    return (
      <SidebarMenuItem key={guild.id} style={unreadCount > 0 ? {backgroundColor: "rgba(255, 165, 0, 0.5)"} : undefined}>
        <SidebarMenuButton asChild isActive={isActive({ url })}>
          <Link href={url}>
            <MessageSquare />
            <span>{guild.name}</span>
            {unreadCount > 0 ? (
              <span className="ml-auto rounded-full bg-orange-500 px-2 py-0.5 text-xs font-semibold text-white">
                {unreadCount}
              </span>
            ) : null}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  })

  return (
    <Sidebar variant="floating" collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <button>
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <MessageSquare className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">ギルドチャット</span>
                  <span className="truncate text-xs">
                    (InterChat)
                  </span>
                </div>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive({ url: "/" })}>
              <Link href="/">
                <HomeIcon />
                <span>ホーム</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {guildElements}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <NavUser />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
