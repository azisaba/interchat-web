export type GuildRole = "OWNER" | "MODERATOR" | "MEMBER";

const ROLE_ORDER: Record<GuildRole, number> = {
  OWNER: 3,
  MODERATOR: 2,
  MEMBER: 1,
};

export function hasHigherOrEqualRole(actor: GuildRole, target: GuildRole) {
  return ROLE_ORDER[actor] >= ROLE_ORDER[target];
}
