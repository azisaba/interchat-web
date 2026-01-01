export const DEFAULT_FORMAT =
  "&b[&a%gname&7@&6%server&b] &r%username&a: &r%msg &7%prereplace-b";

export const BLOCKED_GUILD_NAMES = new Set([
  "create",
  "format",
  "chat",
  "delete",
  "select",
  "role",
  "invite",
  "kick",
  "ban",
  "ban-public",
  "unban",
  "pardon",
  "leave",
  "dontinviteme",
  "toggleinvites",
  "accept",
  "reject",
  "info",
  "log",
  "jp-on",
  "jp-off",
  "linkdiscord",
  "unlinkdiscord",
  "nick",
  "force-nick",
  "open",
  "join",
  "hideall",
  "hide-guild",
  "hide-player",
  "permission",
  "permissions",
]);

export const GUILD_NAME_PATTERN = /^[a-zA-Z0-9_.+\-]{2,32}$/;
