import { ethers } from "ethers";

const CENTRAL_REGISTRY = "0x1310f352f1389969Ece6741671c4B919523912fF";
const RPC_URL = "https://rpc.monad.xyz";

const CENTRAL_REGISTRY_ABI = [
  "function getUserData(address account) external view returns (tuple(tuple(uint256 lockIndex, uint256 amount, uint256 unlockTime)[] locks, tuple(address _address, uint256 collateral, uint256 maxDebt, uint256 debt, uint256 positionHealth, uint256 cooldown, bool errorCodeHit, tuple(address _address, uint256 userAssetBalance, uint256 userShareBalance, uint256 userUnderlyingBalance, uint256 userCollateral, uint256 userDebt, uint256 liquidationPrice, uint256 exchangeRate)[] tokens)[] markets) data)",
];

export interface CurvancePosition {
  marketManager: string;
  lFactor: number;
  debt: number;
}

export async function getCurvanceHealth(walletAddress: string): Promise<CurvancePosition[]> {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const registry = new ethers.Contract(CENTRAL_REGISTRY, CENTRAL_REGISTRY_ABI, provider);
  const positions: CurvancePosition[] = [];

  try {
    const userData = await registry.getUserData(walletAddress);

    // userData.data.markets es el array de mercados del usuario
    for (const market of userData.data.markets) {
      const debt = market.debt;
      const positionHealth = market.positionHealth;

      // positionHealth = 0 significa sin deuda
      if (debt > 0n && positionHealth > 0n) {
        positions.push({
          marketManager: market._address,
          lFactor: parseFloat(ethers.formatUnits(positionHealth, 18)),
          debt: parseFloat(ethers.formatUnits(debt, 18)),
        });
      }
    }
  } catch (error) {
    console.error(`[Curvance] Error consultando ${walletAddress}:`, error);
  }

  return positions;
}
