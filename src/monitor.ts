import { checkHealthFactor } from "./libs/aave";
import { checkCurvanceHealth } from "./libs/curvance";
import { WALLETS } from "./wallets";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

async function checkAllWallets(): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] Revisando ${WALLETS.length} wallet(s)...`);

  for (const wallet of WALLETS) {
    await checkHealthFactor(wallet);
    await checkCurvanceHealth(wallet);
  }

  console.log(`[${timestamp}] Check completado. Próxima revision en ${CHECK_INTERVAL_MS / 1000 / 60} min.`);
}

async function main(): Promise<void> {
  console.log("=== Mandate Risk Monitor iniciado ===");
  console.log(`Wallets monitoreadas: ${WALLETS.length}`);
  console.log(`Intervalo: ${CHECK_INTERVAL_MS / 1000 / 60} minutos\n`);

  // Primera revision inmediata
  await checkAllWallets();

  // Loop continuo
  setInterval(checkAllWallets, CHECK_INTERVAL_MS);
}

main().catch((error) => {
  console.error("Error fatal:", error);
  process.exit(1);
});
