import "dotenv/config";
import { getHealthFactor } from "./libs/aave";
import { getAllUsersWithWallets } from "./db";
import { startDiscordBot, sendDMToUser } from "./discord-bot";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const alerted = new Set<string>();

async function checkAllWallets() {
  const users = getAllUsersWithWallets();
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] Revisando ${users.length} wallet(s)...`);

  for (const user of users) {
    const hf = await getHealthFactor(user.wallet);
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

async function main() {
  console.log("=== Mandate Risk Monitor iniciado ===");
  await startDiscordBot();
  await checkAllWallets();
  setInterval(checkAllWallets, CHECK_INTERVAL_MS);
}

main().catch((error) => {
  console.error("Error fatal:", error);
  process.exit(1);
});
