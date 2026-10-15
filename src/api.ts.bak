import express from "express";
import cors from "cors";
import { addWalletToUser, getUserWallets, getAllUsersWithWallets } from "./db";
import { getHealthFactorNumber } from "./libs/aave";
import { checkCurvancePosition } from "./libs/curvance";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API corriendo en puerto ${PORT}`);
});

export default app;
