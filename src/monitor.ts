import "dotenv/config";
import express from "express";
import cors from "cors";
import { getHealthFactorNumber } from "./libs/aave";
import { checkCurvancePosition } from "./libs/curvance";
import { getAllUsersWithWallets, addWalletToUser, getUserWallets, removeWallet } from "./db";
import { startDiscordBot, sendDMToUser } from "./discord-bot";
import DodoPayments from "dodopayments";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const alertedAave = new Set<string>();
const alertedCurvance = new Set<string>();

// ===== API HTTP =====
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── Dodo Payments ───
const dodo = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY || "",
  environment: (process.env.DODO_ENVIRONMENT as "live_mode" | "test_mode") || "live_mode",
});

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
    ratio: result.ratio,
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
      feature_flags: {
        allow_customer_editing_email: true,
      },
      return_url: "https://github.com/chan30038917-hue/mandate-risk-extension",
    });

    res.json({ checkout_url: session.checkout_url });
  } catch (error) {
    console.error("Error creando checkout de Dodo:", error);
    res.status(500).json({ 
      error: "Error creando checkout",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});


// ─── Lemon Squeezy: Activación y validación de licencias ───
app.post("/api/validate-license", async (req, res) => {
  const { licenseKey } = req.body;
  if (!licenseKey) {
    return res.status(400).json({ valid: false, error: "Falta la licencia" });
  }

  try {
    // Dodo Payments no requiere API Key para validar licencias.
    // Usamos el endpoint de live_mode. Si estás probando, cambia a test.dodopayments.com
    const response = await fetch("https://live.dodopayments.com/licenses/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ license_key: licenseKey }),
    });

    const data = await response.json();
    
    // Dodo devuelve { valid: true } si la licencia es correcta
    res.json({ valid: data.valid === true });
  } catch (error) {
    console.error("Error validando licencia de Dodo:", error);
    res.status(500).json({ valid: false, error: "Error de red" });
  }
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
      const risk = curvanceResult.riskLevel || 0;
      const debt = curvanceResult.debtUsd || 0;

      // Solo alertar si riskLevel >= 0.25 (PRECAUCIÓN, CRÍTICO o LIQUIDACIÓN)
      if (risk >= 0.25 && !alertedCurvance.has(key)) {
        let emoji: string;
        let nivel: string;

        if (risk >= 1.0) {
          emoji = "🚨";
          nivel = "LIQUIDACION";
        } else if (risk >= 0.75) {
          emoji = "🚨";
          nivel = "CRITICO";
        } else {
          emoji = "⚠️";
          nivel = "PRECAUCION";
        }

        await sendDMToUser(
          user.discordId,
          `${emoji} **Alerta Curvance - ${nivel}**\n\n` +
          `Wallet: \`${user.wallet.slice(0, 6)}...${user.wallet.slice(-4)}\`\n` +
          `Deuda: **$${debt.toFixed(2)}**\n` +
          `Mercado: ${curvanceResult.marketName}\n` +
          `Nivel de riesgo: **${nivel}**\n\n` +
          `Considera anadir margen.`
        );
        alertedCurvance.add(key);
      }

      // Resetear la alerta si vuelve a estar seguro (riskLevel < 0.25)
      if (risk < 0.25) {
        alertedCurvance.delete(key);
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
