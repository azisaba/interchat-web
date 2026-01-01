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
import {HomeIcon, MessageSquare, Plus} from 'lucide-react'
import Link from "next/link";
import NavUser from "@/components/nav-user";
import {useGuildList} from "@/hooks/use-azisaba";
import {markGuildRead, useInterchatUnreadCounts} from "@/hooks/use-interchat-store";
import {useEffect, useMemo, useState} from "react";
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {toast} from "sonner";
import useLocalStorage from "@/hooks/use-local-storage";

export default function AppSidebar() {
  const pathname = usePathname();
  const guildList = useGuildList();
  const unreadCounts = useInterchatUnreadCounts();
  const [token] = useLocalStorage("token");
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);

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

  const formatCooldown = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const days = Math.floor(totalSeconds / (24 * 60 * 60));
    const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.ceil(totalSeconds / 60);
    return `${minutes}m`;
  };

  const handleCreateGuild = async () => {
    if (!token || token === "null") {
      toast("ログインしてください。");
      return;
    }
    const name = createName.trim();
    if (!name) {
      toast("ギルド名は必須です。");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/guilds/create", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({name}),
      });
      if (res.status === 429) {
        const body = (await res.json().catch(() => null)) as {retry_after_ms?: number} | null;
        const remainingMs = body?.retry_after_ms ?? 0;
        toast(`ギルドの作成はクールタイム中です: ${formatCooldown(remainingMs)}`);
        return;
      }
      if (!res.ok) {
        toast(`ギルドの作成に失敗しました (${res.status}) ${await res.text()}`);
        return;
      }
      const created = (await res.json()) as {id: number; name: string};
      const cached = localStorage.getItem("guildListCache");
      let list: Array<{id: number; name: string}> = [];
      if (cached) {
        try {
          list = JSON.parse(cached) as Array<{id: number; name: string}>;
        } catch {
          list = [];
        }
      }
      list.push({id: created.id, name: created.name});
      localStorage.setItem("guildListCache", JSON.stringify(list));
      localStorage.setItem("guildListCacheTs", Date.now().toString());
      setCreateOpen(false);
      setCreateName("");
      window.location.assign(`/guilds/${created.id}`);
    } catch (error) {
      toast(`ギルドの作成に失敗しました: ${(error as Error).message}`);
    } finally {
      setCreating(false);
    }
  };

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
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setCreateOpen(true)}
              disabled={!token || token === "null"}
            >
              <Plus />
              <span>ギルドを作成</span>
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
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ギルドを作成</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              placeholder="ギルド名"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              maxLength={32}
            />
          </div>
          <DialogFooter className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleCreateGuild} disabled={creating}>
              {creating ? "作成中..." : "作成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  )
}
