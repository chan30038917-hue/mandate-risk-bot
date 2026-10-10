import express from "express";
import cors from "cors";
import { addWalletToUser, getUserWallets, getAllUsersWithWallets } from "./db";
import { getHealthFactorNumber } from "./libs/aave";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check para Railway
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

// Registrar una wallet desde la extensión
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

// Listar wallets de un usuario
app.get("/api/wallets/:discordId", (req, res) => {
  const wallets = getUserWallets(req.params.discordId);
  res.json({ wallets });
});

// Obtener health factor de una wallet
app.get("/api/health-factor/:wallet", async (req, res) => {
  const hf = await getHealthFactorNumber(req.params.wallet);
  res.json({ wallet: req.params.wallet, healthFactor: hf });
});

// Listar todos los usuarios (para el bot)
app.get("/api/all-users", (req, res) => {
  const users = getAllUsersWithWallets();
  res.json({ users });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API corriendo en puerto ${PORT}`);
});

export default app;
