import "dotenv/config";
import express from "express";
import cors from "cors";
import { getHealthFactorNumber } from "./libs/aave";
import { getAllUsersWithWallets, addWalletToUser, getUserWallets, removeWallet } from "./db";
import { startDiscordBot, sendDMToUser } from "./discord-bot";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const alerted = new Set<string>();

// ===== API HTTP =====
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "Mandate Risk Monitor API", version: "1.0.0" });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

app.post("/api/register", (req, res) => {
  const { discordId, wallet } = req.body;

  if (!discordId || !wallet) {
    return res.status(400).json({ error: "discordId y wallet son requeridos" });
  }

  if (!wallet.startsWith("0x") || wallet.length !== 42) {
    return res.status(400).json({ error: "Direccion invalida" });
  }

  addWalletToUser(discordId, wallet);
  res.json({ success: true, message: "Wallet registrada" });
});

app.get("/api/wallets/:discordId", (req, res) => {
  const wallets = getUserWallets(req.params.discordId);
  res.json({ wallets });
});

app.delete("/api/wallets", (req, res) => {
  const { discordId, wallet } = req.body;

  if (!discordId || !wallet) {
    return res.status(400).json({ error: "discordId y wallet son requeridos" });
  }

  removeWallet(discordId, wallet);
  res.json({ success: true, message: "Wallet eliminada" });
});

app.get("/api/health-factor/:wallet", async (req, res) => {
  const hf = await getHealthFactorNumber(req.params.wallet);
  res.json({ wallet: req.params.wallet, healthFactor: hf });
});

// ===== MONITOR =====
async function checkAllWallets() {
  const users = getAllUsersWithWallets();
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] Revisando ${users.length} wallet(s)...`);

  for (const user of users) {
    const hf = await getHealthFactorNumber(user.wallet);
    const key = `${user.discordId}:${user.wallet}`;

    if (hf < 1.5 && !alerted.has(key)) {
      const riskLevel = hf < 1.1 ? "CRITICO" : "PRECAUCION";
      await sendDMToUser(
        user.discordId,
        `⚠️ **Alerta de riesgo**\n\nWallet: \`${user.wallet.slice(0, 6)}...${user.wallet.slice(-4)}\`\nHealth Factor: **${hf.toFixed(4)}** (${riskLevel})\n\nConsidera anadir margen.`
      );
      alerted.add(key);
    }

    if (hf > 1.8) {
      alerted.delete(key);
    }
  }
  console.log(`[${timestamp}] Check completado.`);
}

// ===== MAIN =====
async function main() {
  console.log("=== Mandate Risk Monitor iniciado ===");

  // Arrancar API HTTP
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`API corriendo en puerto ${PORT}`);
  });

  // Arrancar bot de Discord
  await startDiscordBot();

  // Arrancar monitor de wallets
  await checkAllWallets();
  setInterval(checkAllWallets, CHECK_INTERVAL_MS);
}

main().catch((error) => {
  console.error("Error fatal:", error);
  process.exit(1);
});
