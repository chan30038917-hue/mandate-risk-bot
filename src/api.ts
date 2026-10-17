import express from "express";
import cors from "cors";
import { addWalletToUser, getUserWallets, getAllUsersWithWallets } from "./db";
import { getHealthFactorNumber } from "./libs/aave";
import { checkCurvancePosition } from "./libs/curvance";
import DodoPayments from "dodopayments";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── Dodo Payments ───
const dodo = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY || "",
  environment: (process.env.DODO_ENVIRONMENT as "live_mode" | "test_mode") || "live_mode",
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

app.post("/api/create-checkout", async (req, res) => {
  try {
    const { email } = req.body;

    const session = await dodo.checkoutSessions.create({
      product_cart: [
        {
          product_id: "pdt_0NpndMqzbLZS4SMoC433b",
          quantity: 1,
        },
      ],
      customer: {
        email: email || "customer@example.com",
      },
      return_url: "https://github.com/chan30038917-hue/mandate-risk-extension",
    });

    res.json({ checkout_url: session.checkout_url });
  } catch (error) {
    console.error("Error creando checkout de Dodo:", error);
    res.status(500).json({ error: "Error creando checkout" });
  }
});

// ─── Lemon Squeezy: Validación de licencias ───
app.post("/api/validate-license", async (req, res) => {
  const { licenseKey } = req.body;
  if (!licenseKey) {
    return res.status(400).json({ valid: false, error: "Falta la licencia" });
  }

  try {
    const response = await fetch("https://api.lemonsqueezy.com/v1/licenses/validate", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${process.env.LEMON_API_KEY || ""}`,
      },
      body: new URLSearchParams({ license_key: licenseKey }),
    });

    const data = await response.json();
    const isValid = data.valid === true && data.license_key?.status === "active";

    res.json({
      valid: isValid,
      status: data.license_key?.status || "unknown",
    });
  } catch (error) {
    console.error("Error validando licencia de Lemon:", error);
    res.status(500).json({ valid: false, error: "Error de red" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API corriendo en puerto ${PORT}`);
});

export default app;
