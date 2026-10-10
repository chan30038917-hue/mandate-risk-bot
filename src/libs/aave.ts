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

export async function checkHealthFactor(userAddress: string): Promise<void> {
  try {
    const data = await pool.getUserAccountData(userAddress);
    const healthFactor = data[5];

    if (healthFactor > ethers.parseUnits("100", 18)) {
      console.log(`[${userAddress}] Sin deuda activa`);
      return;
    }

    const hfFormatted = ethers.formatUnits(healthFactor, 18);
    console.log(`[${userAddress}] Health Factor: ${hfFormatted}`);

    if (healthFactor < CRITICAL_THRESHOLD) {
      await sendDiscordAlert(
        `🚨 **CRÍTICO** 🚨\n\nWallet: \`${userAddress}\`\nHealth Factor: **${hfFormatted}**\nAcción requerida: Añade colateral o cierra posición AHORA.`
      );
    } else if (healthFactor < DANGER_THRESHOLD) {
      await sendDiscordAlert(
        `⚠️ **Alerta de riesgo**\n\nWallet: \`${userAddress}\`\nHealth Factor: **${hfFormatted}**\nConsidera añadir margen.`
      );
    }
  } catch (error) {
    console.error(`Error consultando ${userAddress}:`, error);
  }
}
