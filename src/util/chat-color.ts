import React from "react";
import Colored from "@/components/colored";
import Obfuscated from "@/components/obfuscated";

export const COLOR_REGEX = /[&§]([0-9a-flmnox]|#[0-9a-f])/gi

const COLOR_CODES: Record<string, string> = {
  "0": "#000000",
  "1": "#0000AA",
  "2": "#00AA00",
  "3": "#00AAAA",
  "4": "#AA0000",
  "5": "#AA00AA",
  "6": "#FFAA00",
  "7": "#AAAAAA",
  "8": "#555555",
  "9": "#5555FF",
  a: "#55FF55",
  b: "#55FFFF",
  c: "#FF5555",
  d: "#FF55FF",
  e: "#FFFF55",
  f: "#FFFFFF",
};

type ColoredChunk = {
  text: string;
  color: string | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  obfuscated: boolean;
};

export function stripColor(color: string) {
  return color.replace(COLOR_REGEX, '')
}

function isHexChar(value: string) {
  return /^[0-9a-f]$/i.test(value);
}

export function parseChatColors(input: string): ColoredChunk[] {
  const chunks: ColoredChunk[] = [];
  let buffer = "";
  let currentColor: string | null = null;
  let bold = false;
  let italic = false;
  let underline = false;
  let strike = false;
  let obfuscated = false;

  const flush = () => {
    if (!buffer) return;
    chunks.push({
      text: buffer,
      color: currentColor,
      bold,
      italic,
      underline,
      strike,
      obfuscated,
    });
    buffer = "";
  };

  let i = 0;
  while (i < input.length) {
    const char = input[i];
    if (char === "&" || char === "§") {
      const next = input[i + 1];
      if (!next) {
        buffer += char;
        i += 1;
        continue;
      }
      if (next === "x" || next === "X") {
        let j = i + 2;
        let hex = "";
        for (let k = 0; k < 6; k += 1) {
          const prefix = input[j];
          const digit = input[j + 1];
          if ((prefix === "&" || prefix === "§") && digit && isHexChar(digit)) {
            hex += digit;
            j += 2;
          } else {
            hex = "";
            break;
          }
        }
        if (hex.length === 6) {
          flush();
          currentColor = `#${hex.toLowerCase()}`;
          i = j;
          continue;
        }
      }
      if (next === "#") {
        const hex = input.slice(i + 2, i + 8);
        if (hex.length === 6 && [...hex].every(isHexChar)) {
          flush();
          currentColor = `#${hex.toLowerCase()}`;
          i += 8;
          continue;
        }
      }
      const mapped = COLOR_CODES[next.toLowerCase()];
      if (mapped) {
        flush();
        currentColor = mapped;
        i += 2;
        continue;
      }
      const lower = next.toLowerCase();
      if (lower === "l") {
        flush();
        bold = true;
        i += 2;
        continue;
      }
      if (lower === "o") {
        flush();
        italic = true;
        i += 2;
        continue;
      }
      if (lower === "n") {
        flush();
        underline = true;
        i += 2;
        continue;
      }
      if (lower === "m") {
        flush();
        strike = true;
        i += 2;
        continue;
      }
      if (lower === "k") {
        flush();
        obfuscated = true;
        i += 2;
        continue;
      }
      if (lower === "r") {
        flush();
        currentColor = null;
        bold = false;
        italic = false;
        underline = false;
        strike = false;
        obfuscated = false;
        i += 2;
        continue;
      }
    }
    buffer += char;
    i += 1;
  }

  flush();
  return chunks;
}

export function renderChatColors(input: string) {
  const chunks = parseChatColors(input);
  return chunks.map((chunk, index) => {
    const hasFormatting =
      chunk.color || chunk.bold || chunk.italic || chunk.underline || chunk.strike || chunk.obfuscated;
    const content = chunk.obfuscated
      ? React.createElement(Obfuscated, {text: chunk.text})
      : chunk.text;
    if (!hasFormatting) {
      return content;
    }
    return React.createElement(
      Colored,
      // @ts-expect-error "do not pass children as props"
      {
        key: `chat-color-${index}`,
        color: chunk.color ?? undefined,
        bold: chunk.bold,
        italic: chunk.italic,
        underline: chunk.underline,
        strike: chunk.strike,
      },
      content
    );
  });
}

function trimTrailingPunctuation(value: string) {
  let result = value;
  while (/[),.!?;]+$/.test(result)) {
    result = result.slice(0, -1);
  }
  return result;
}

function isImageUrl(value: string) {
  try {
    const url = new URL(value);
    const ext = url.pathname.split(".").pop()?.toLowerCase();
    return ext !== undefined && ["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext);
  } catch {
    return false;
  }
}

function isDirectImageHost(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === "cdn.discordapp.com" || url.hostname === "cdn.discord.com";
  } catch {
    return false;
  }
}

export function renderChatMessage(input: string) {
  const parts: React.ReactNode[] = [];
  const urlRegex = /https?:\/\/\S+/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...renderChatColors(input.slice(lastIndex, match.index)));
    }

    const rawUrl = match[0];
    const trimmedUrl = trimTrailingPunctuation(rawUrl);
    if (isImageUrl(trimmedUrl)) {
      const proxied = isDirectImageHost(trimmedUrl)
        ? trimmedUrl
        : `/api/image-proxy?url=${encodeURIComponent(trimmedUrl)}`;
      parts.push(
        React.createElement("img", {
          key: `chat-image-${match.index}`,
          src: proxied,
          alt: "image",
          loading: "lazy",
          className: "mt-2 max-w-full rounded-md border",
        })
      );
    } else {
      parts.push(...renderChatColors(rawUrl));
    }

    lastIndex = match.index + rawUrl.length;
  }

  if (lastIndex < input.length) {
    parts.push(...renderChatColors(input.slice(lastIndex)));
  }

  return parts;
}
