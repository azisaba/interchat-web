"use client";

import {useEffect, useMemo, useState} from "react";
import {usePathname} from "next/navigation";
import {Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem} from "@/components/ui/sidebar";
import {useGuildMembers} from "@/hooks/use-azisaba";
import {useSelfUser} from "@/hooks/use-azisaba";
import useLocalStorage from "@/hooks/use-local-storage";
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {toast} from "sonner";
import {renderChatColors} from "@/util/chat-color";

type MemberRow = {
  guild_id: number;
  uuid: string;
  role: string;
  nickname: string | null;
  name: string;
};

type MenuState = {
  member: MemberRow;
  x: number;
  y: number;
} | null;

function getGuildId(pathname: string) {
  const match = pathname.match(/^\/guilds\/(\d+)/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isNaN(id) ? null : id;
}

function roleRank(role: string) {
  switch (role) {
    case "OWNER":
      return 3;
    case "MODERATOR":
      return 2;
    default:
      return 1;
  }
}

export default function MemberSidebar() {
  const pathname = usePathname();
  const guildId = useMemo(() => getGuildId(pathname), [pathname]);
  const members = useGuildMembers(guildId ?? -1);
  const self = useSelfUser();
  const [token] = useLocalStorage("token");
  const [menu, setMenu] = useState<MenuState>(null);
  const [selectedMember, setSelectedMember] = useState<MemberRow | null>(null);
  const [kickDialogOpen, setKickDialogOpen] = useState(false);
  const [nickDialogOpen, setNickDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [kickReason, setKickReason] = useState("");
  const [nickname, setNickname] = useState("");

  const selfMember = useMemo(
    () => members.find((member) => member.uuid === self?.uuid),
    [members, self?.uuid]
  );
  const selfRole = selfMember?.role ?? null;

  const canManage = selfRole === "OWNER" || selfRole === "MODERATOR";
  const canForceNick = selfRole === "OWNER";

  useEffect(() => {
    if (!menu) return;
    const handler = () => setMenu(null);
    window.addEventListener("click", handler);
    return () => {
      window.removeEventListener("click", handler);
    };
  }, [menu]);

  if (!guildId) {
    return null;
  }

  const openKickDialog = () => {
    if (menu) {
      setSelectedMember(menu.member);
    }
    setKickReason("");
    setKickDialogOpen(true);
  };

  const openNickDialog = () => {
    if (menu) {
      setSelectedMember(menu.member);
      setNickname(menu.member.nickname ?? "");
    } else {
      setNickname("");
    }
    setNickDialogOpen(true);
  };

  const openRoleDialog = () => {
    if (menu) {
      setSelectedMember(menu.member);
    }
    setRoleDialogOpen(true);
  };

  const performKick = async () => {
    if (!selectedMember || !token) return;
    const target = selectedMember;
    try {
      const res = await fetch(`/api/guilds/${guildId}/kick`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({targetUuid: target.uuid, reason: kickReason || undefined}),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed (${res.status})`);
      }
      toast("Kick complete");
      setKickDialogOpen(false);
    } catch (error) {
      toast(`Kick failed: ${(error as Error).message}`);
    }
  };

  const performForceNick = async () => {
    if (!selectedMember || !token) return;
    const target = selectedMember;
    const trimmed = nickname.trim();
    try {
      const res = await fetch(`/api/guilds/${guildId}/force-nick`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUuid: target.uuid,
          nickname: trimmed.length === 0 ? "off" : trimmed,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed (${res.status})`);
      }
      toast("Nickname updated");
      setNickDialogOpen(false);
    } catch (error) {
      toast(`Nickname update failed: ${(error as Error).message}`);
    }
  };

  const performRoleChange = async (role: "OWNER" | "MODERATOR" | "MEMBER") => {
    if (!selectedMember || !token) return;
    const target = selectedMember;
    try {
      const res = await fetch(`/api/guilds/${guildId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({targetUuid: target.uuid, role}),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed (${res.status})`);
      }
      toast("Role updated");
      setRoleDialogOpen(false);
    } catch (error) {
      toast(`Role update failed: ${(error as Error).message}`);
    }
  };

  const canKickTarget = (member: MemberRow) => {
    if (!selfRole) return false;
    if (selfRole === "OWNER") return true;
    if (selfRole === "MODERATOR") {
      return roleRank(selfRole) < roleRank(member.role);
    }
    return false;
  };

  return (
    <>
      <Sidebar side="right" collapsible="none" className="border-l border-sidebar-border">
        <SidebarHeader>
          <div className="px-3 py-2 text-sm font-semibold">Members</div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {members.map((member) => {
              const displayName = member.nickname || member.name || member.uuid;
              return (
                <SidebarMenuItem key={member.uuid}>
                  <div
                    className="flex cursor-default items-center justify-between gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
                    onContextMenu={(event) => {
                      if (!canManage) return;
                      if (!canKickTarget(member) && !canForceNick) return;
                      event.preventDefault();
                      setMenu({member, x: event.clientX, y: event.clientY});
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{renderChatColors(displayName)}</span>
                      <span className="text-xs text-muted-foreground">{member.role}</span>
                    </div>
                  </div>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>

      {menu ? (
        <div
          className="fixed z-50 min-w-[10rem] rounded-md border bg-popover text-popover-foreground shadow-md"
          style={{top: menu.y, left: menu.x}}
        >
          {canForceNick ? (
            <button
              className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => {
                openNickDialog();
              }}
            >
              Force nickname
            </button>
          ) : null}
          {canForceNick ? (
            <button
              className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => {
                openRoleDialog();
              }}
            >
              Change role
            </button>
          ) : null}
          {canKickTarget(menu.member) ? (
            <button
              className="block w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
              onClick={() => {
                openKickDialog();
              }}
            >
              Kick
            </button>
          ) : null}
        </div>
      ) : null}

      <Dialog open={kickDialogOpen} onOpenChange={setKickDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kick member</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Reason (optional)"
            value={kickReason}
            onChange={(event) => setKickReason(event.target.value)}
          />
          <DialogFooter>
            <Button variant="destructive" onClick={performKick}>
              Kick
            </Button>
            <Button variant="secondary" onClick={() => setKickDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={nickDialogOpen} onOpenChange={setNickDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force nickname</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nickname (empty to reset)"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
          />
          <DialogFooter>
            <Button onClick={performForceNick}>Save</Button>
            <Button variant="secondary" onClick={() => setNickDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            {selectedMember?.nickname || selectedMember?.name || selectedMember?.uuid}
          </div>
          <DialogFooter className="flex flex-wrap gap-2">
            <Button onClick={() => performRoleChange("OWNER")}>Owner</Button>
            <Button onClick={() => performRoleChange("MODERATOR")}>Moderator</Button>
            <Button onClick={() => performRoleChange("MEMBER")}>Member</Button>
            <Button variant="secondary" onClick={() => setRoleDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
