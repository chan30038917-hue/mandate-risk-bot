import Database from "better-sqlite3";

const db = new Database("./data/bot.db");
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    discord_id TEXT NOT NULL,
    wallet TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (discord_id, wallet)
  )
`);

export function addWalletToUser(discordId: string, wallet: string) {
  db.prepare("INSERT OR IGNORE INTO users (discord_id, wallet, created_at) VALUES (?, ?, ?)")
    .run(discordId, wallet, Date.now());
}

export function getUserWallets(discordId: string): string[] {
  const rows = db.prepare("SELECT wallet FROM users WHERE discord_id = ?").all(discordId) as { wallet: string }[];
  return rows.map((r) => r.wallet);
}

export function getAllUsersWithWallets(): { discordId: string; wallet: string }[] {
  const rows = db.prepare("SELECT discord_id, wallet FROM users").all() as { discord_id: string; wallet: string }[];
  return rows.map((r) => ({ discordId: r.discord_id, wallet: r.wallet }));
}

export function removeWallet(discordId: string, wallet: string) {
  db.prepare("DELETE FROM users WHERE discord_id = ? AND wallet = ?").run(discordId, wallet);
}
