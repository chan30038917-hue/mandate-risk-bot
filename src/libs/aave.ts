import { ethers } from "ethers";
import { sendDiscordAlert } from "./discord";

const AAVE_POOL = "0x69a5f9ad4f96ebf0a0c792dd42a01cc5c0102fef";
const RPC_URL = "https://rpc.monad.xyz";

const AAVE_POOL_ABI = [
  "function getUserAccountData(address user) external view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const pool = new ethers.Contract(AAVE_POOL, AAVE_POOL_ABI, provider);

const DANGER_THRESHOLD = ethers.parseUnits("1.5", 18);
const CRITICAL_THRESHOLD = ethers.parseUnits("1.1", 18);

// Nueva funcion: devuelve solo el numero del health factor
export async function getHealthFactorNumber(userAddress: string): Promise<number> {
  try {
    const data = await pool.getUserAccountData(userAddress);
    const healthFactor = data[5];

    if (healthFactor > ethers.parseUnits("100", 18)) {
      return 999; // Sin deuda
    }

    return parseFloat(ethers.formatUnits(healthFactor, 18));
  } catch (error) {
    console.error(`Error consultando ${userAddress}:`, error);
    return 999;
  }
}

// Funcion original: envia alerta a Discord si hay riesgo
export async function checkHealthFactor(userAddress: string): Promise<void> {
  try {
    const healthFactor = await pool.getUserAccountData(userAddress);
    const hf = healthFactor[5];

    if (hf > ethers.parseUnits("100", 18)) {
      console.log(`[${userAddress}] Sin deuda activa`);
      return;
    }

    const hfFormatted = ethers.formatUnits(hf, 18);
    console.log(`[${userAddress}] Health Factor: ${hfFormatted}`);

    if (hf < CRITICAL_THRESHOLD) {
      await sendDiscordAlert(
        `🚨 **CRÍTICO** 🚨\n\n` +
        `Wallet: \`${userAddress}\`\n` +
        `Health Factor: **${hfFormatted}**\n` +
        `Acción requerida: Añade colateral o cierra posición AHORA.`
      );
    } else if (hf < DANGER_THRESHOLD) {
      await sendDiscordAlert(
        `⚠️ **Alerta de riesgo**\n\n` +
        `Wallet: \`${userAddress}\`\n` +
        `Health Factor: **${hfFormatted}**\n` +
        `Considera añadir margen.`
      );
    }
  } catch (error) {
    console.error(`Error consultando ${userAddress}:`, error);
  }
}
