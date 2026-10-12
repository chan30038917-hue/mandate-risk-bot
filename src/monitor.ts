import "dotenv/config";
import express from "express";
import cors from "cors";
import { getHealthFactorNumber } from "./libs/aave";
import { checkCurvancePosition } from "./libs/curvance";
import { getAllUsersWithWallets, addWalletToUser, getUserWallets, removeWallet } from "./db";
import { startDiscordBot, sendDMToUser } from "./discord-bot";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const alertedAave = new Set<string>();
const alertedCurvance = new Set<string>();

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
  res.json({ wallet: req.params.wallet, healthFactor: hf, protocol: "Aave V3" });
});

app.get("/api/curvance-health/:wallet", async (req, res) => {
  const result = await checkCurvancePosition(req.params.wallet);
  res.json({
    wallet: req.params.wallet,
    hasDebt: result.hasDebt,
    debtUsd: result.debtUsd,
    marketName: result.marketName,
    riskLevel: result.riskLevel,
    error: result.error,
    protocol: "Curvance"
  });
});

app.get("/api/all-users", (req, res) => {
  const users = getAllUsersWithWallets();
  res.json({ users });
});

// ===== MONITOR =====
async function checkAllWallets() {
  const users = getAllUsersWithWallets();
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] Revisando ${users.length} wallet(s)...`);

  for (const user of users) {
    const key = `${user.discordId}:${user.wallet}`;

    // === AAVE ===
    const hfAave = await getHealthFactorNumber(user.wallet);
    if (hfAave < 1.5 && !alertedAave.has(key)) {
      const riskLevel = hfAave < 1.1 ? "CRITICO" : "PRECAUCION";
      await sendDMToUser(
        user.discordId,
        `⚠️ **Alerta Aave**\n\nWallet: \`${user.wallet.slice(0, 6)}...${user.wallet.slice(-4)}\`\nHealth Factor: **${hfAave.toFixed(4)}** (${riskLevel})\n\nConsidera anadir margen.`
      );
      alertedAave.add(key);
    }
    if (hfAave > 1.8) {
      alertedAave.delete(key);
    }

    // === CURVANCE ===
    const curvanceResult = await checkCurvancePosition(user.wallet);
    if (curvanceResult.hasDebt && !curvanceResult.error) {
      const debt = curvanceResult.debtUsd || 0;
      if (debt > 1000 && !alertedCurvance.has(key)) {
        await sendDMToUser(
          user.discordId,
          `⚠️ **Alerta Curvance**\n\nWallet: \`${user.wallet.slice(0, 6)}...${user.wallet.slice(-4)}\`\nDeuda: **$${debt.toFixed(2)}**\nMercado: ${curvanceResult.marketName}\n\nConsidera anadir margen.`
        );
        alertedCurvance.add(key);
      }
    }
  }
  console.log(`[${timestamp}] Check completado.`);
}

// ===== MAIN =====
async function main() {
  console.log("=== Mandate Risk Monitor iniciado ===");

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`API corriendo en puerto ${PORT}`);
  });

  try {
    await startDiscordBot();
  } catch (error) {
    console.error("Discord fallo, pero el API sigue corriendo:", error);
  }

  await checkAllWallets();
  setInterval(checkAllWallets, CHECK_INTERVAL_MS);
}

main().catch((error) => {
  console.error("Error fatal:", error);
  process.exit(1);
});
