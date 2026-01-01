"use client";

import {useEffect, useState} from "react";

type ObfuscatedProps = {
  text: string;
  intervalMs?: number;
};

const CHARSET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const DEFAULT_INTERVAL_MS = 80;

function obfuscate(text: string) {
  return text
    .split("")
    .map((char) => {
      if (char === " ") return char;
      return CHARSET[Math.floor(Math.random() * CHARSET.length)];
    })
    .join("");
}

export default function Obfuscated({text, intervalMs = DEFAULT_INTERVAL_MS}: ObfuscatedProps) {
  const [display, setDisplay] = useState(() => obfuscate(text));

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplay(obfuscate(text));
    }, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs, text]);
  return <>{display}</>;
}
