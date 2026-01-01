export type AzisabaPlayerAdminStatus = {
  admin: boolean;
  moderator: boolean;
  builder: boolean;
}

export type AzisabaPlayerAdminStatusLife = AzisabaPlayerAdminStatus & {
  rank: number;
  balance: number;
  raw_balance: number;
  raw_offline_balance: number;
  total_play_time: number;
}

export type AzisabaPlayerAdminStatusLgw = AzisabaPlayerAdminStatus & {
  vip: boolean;
}

export type AzisabaPlayer = {
  uuid: string;
  name: string;
  groups: string[];
  servers: Record<string, AzisabaPlayerAdminStatus> & {
    life: AzisabaPlayerAdminStatusLife;
    lgw: AzisabaPlayerAdminStatusLgw;
    lgw2: AzisabaPlayerAdminStatusLgw;
  };
}

export type InterChatGuild = {
  id: number;
  name: string;
  format: string;
  capacity: number;
  deleted: boolean;
  open: boolean;
}

export type InterChatGuildMember = {
  guild_id: number;
  uuid: string;
  name: string;
  role: "OWNER" | "MODERATOR" | "MEMBER";
  nickname: string | null;
}

export type InterChatGuildMessage = {
  type: "guild_message";
  id?: number;
  guild_id: number;
  server: string;
  sender: string;
  message: string;
  transliterated_message: string | null;
  timestamp?: number;
}
