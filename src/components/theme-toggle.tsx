"use client";

import {Moon, Sun} from "lucide-react";
import {useTheme} from "next-themes";
import {DropdownMenuItem} from "@/components/ui/dropdown-menu";

export default function ThemeToggle() {
  const {resolvedTheme, setTheme} = useTheme();
  if (!resolvedTheme) return null;

  const isDark = resolvedTheme === "dark";
  return (
    <DropdownMenuItem onClick={() => setTheme(isDark ? "light" : "dark")}>
      {isDark ? <Sun /> : <Moon />}
      {isDark ? "ライトテーマ" : "ダークテーマ"}
    </DropdownMenuItem>
  );
}
