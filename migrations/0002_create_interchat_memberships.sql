CREATE TABLE IF NOT EXISTS interchat_memberships (
  key TEXT NOT NULL,
  guild_id INTEGER NOT NULL,
  ok INTEGER NOT NULL,
  checked_at INTEGER NOT NULL,
  PRIMARY KEY (key, guild_id)
);
