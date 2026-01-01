"use client";

import {type ReactNode} from "react";

type ColoredProps = {
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  children: ReactNode;
};

export default function Colored({
  color,
  bold,
  italic,
  underline,
  strike,
  children,
}: ColoredProps) {
  const decorations = [
    underline ? "underline" : null,
    strike ? "line-through" : null,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span
      style={{
        color,
        fontWeight: bold ? "700" : undefined,
        fontStyle: italic ? "italic" : undefined,
        textDecoration: decorations || undefined,
      }}
    >
      {children}
    </span>
  );
}
