"use client";

import {ChevronsUpDown, LogIn, LogOut, Pencil} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {useSelfUser} from "@/hooks/use-azisaba";
import {
  Dialog, DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {useState} from "react";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {Input} from "@/components/ui/input";
import {Spinner} from "@/components/ui/spinner";
import {toast} from "sonner";
import useLocalStorage from "@/hooks/use-local-storage";

export default function NavUser() {
  const [tokenField, setTokenField] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [, setToken] = useLocalStorage("token");
  const { isMobile } = useSidebar();
  const self = useSelfUser();
  const avatarFallback = <AvatarFallback className="rounded-lg">{self?.name?.substring(0, Math.min(2, self?.name?.length)) ?? "?"}</AvatarFallback>

  async function doLogin() {
    setLoggingIn(true)
    try {
      await fetch("https://api-ktor.azisaba.net/players/me", {
        headers: {
          "Authorization": "Bearer " + tokenField,
        }
      }).then(async (res) => {
        if (res.ok) {
          setDialogOpen(false)
          setToken(tokenField)
          setTokenField("")
        } else {
          toast(`ログインに失敗しました(${res.status}) ${await res.text()}`)
        }
      })
    } finally {
      setLoggingIn(false)
    }
  }

  function doLogout() {
    setToken(null)
  }

  if (!self) {
    return (
      <>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  {avatarFallback}
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">ログインしていません</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    {avatarFallback}
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">ログインしていません</span>
                    {/*email && <span className="truncate text-xs">{email}</span>*/}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setDialogOpen(true)}>
                <LogIn />
                ログイン
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
        <Dialog open={dialogOpen} onOpenChange={(open) => setDialogOpen(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ログイン</DialogTitle>
              <DialogDescription>アジ鯖APIキーでログインします。アジ鯖内で<code>/apikey</code>を実行することで入手可能です。</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <div className="grid flex-1 gap-2">
                <Label htmlFor="token">
                  APIキー
                </Label>
                <Input id="token" value={tokenField} onChange={(e) => setTokenField(e.target.value)} />
              </div>
            </div>
            <DialogFooter className="sm:justify-start">
              <Button type="button" onClick={doLogin} disabled={loggingIn}>
                {loggingIn ? (
                  <>
                    <Spinner />
                    ログイン中...
                  </>
                ) : (
                  <>
                    <LogIn />
                    ログイン
                  </>
                )}
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  閉じる
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const avatar = self ? <AvatarImage src={`https://mc-heads.net/avatar/${self.uuid}/128`} alt={self.name} /> : null

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <Avatar className="h-8 w-8 rounded-lg">
              {avatar}
              {avatarFallback}
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{self?.name ?? "???"}</span>
              {/*email && <span className="truncate text-xs">{email}</span>*/}
            </div>
            <ChevronsUpDown className="ml-auto size-4" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
          side={isMobile ? "bottom" : "right"}
          align="end"
          sideOffset={4}
        >
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar className="h-8 w-8 rounded-lg">
                {avatar}
                {avatarFallback}
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{self.name}</span>
                {/*email && <span className="truncate text-xs">{email}</span>*/}
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <Pencil />
              データの編集
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={doLogout}>
            <LogOut />
            ログアウト
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
