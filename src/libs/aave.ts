// src/libs/aave.ts
import { JsonRpcProvider, Contract } from 'ethers';

const AAVE_POOL_ADDRESS = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';
const AAVE_POOL_ABI = [
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
];

export interface AavePosition {
  hasDebt: boolean;
  healthFactor?: number | null;
  totalDebtUsd?: number;
  error?: string;
}

export async function checkAavePosition(
  accountAddress: string,
  provider?: JsonRpcProvider
): Promise<AavePosition> {
  try {
    const rpcProvider = provider || new JsonRpcProvider(
      process.env.AAVE_RPC_URL || 'https://ethereum-rpc.publicnode.com'
    );

    const pool = new Contract(AAVE_POOL_ADDRESS, AAVE_POOL_ABI, rpcProvider);
    const data = await pool.getUserAccountData(accountAddress);

    const totalDebtBase = BigInt(data[1]);
    const healthFactorRaw = BigInt(data[5]);

    if (totalDebtBase === 0n) {
      return { hasDebt: false };
    }

    const healthFactor = healthFactorRaw === BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
      ? null
      : Number(healthFactorRaw) / 1e18;

    return {
      hasDebt: true,
      healthFactor,
      totalDebtUsd: Number(totalDebtBase) / 1e8,
    };
  } catch (error: any) {
    return {
      hasDebt: false,
      error: error.message || 'Error desconocido en Aave',
    };
  }
}

export async function getHealthFactorNumber(accountAddress: string): Promise<number> {
  const result = await checkAavePosition(accountAddress);
  if (result.error) {
    console.error(`[Aave] Error obteniendo HF de ${accountAddress}: ${result.error}`);
    return Infinity;
  }
  if (!result.hasDebt || result.healthFactor === null || result.healthFactor === undefined) {
    return Infinity;
  }
  return result.healthFactor;
}
