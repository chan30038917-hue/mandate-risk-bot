// src/libs/aave.ts
import { JsonRpcProvider, Contract } from 'ethers';

const AAVE_POOL_ADDRESS = '0x69a5f9ad4f96ebf0a0c792dd42a01cc5c0102fef';
const AAVE_POOL_ABI = [
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)'
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
      process.env.AAVE_RPC_URL || 'https://rpc.monad.xyz'
    );

    const pool = new Contract(AAVE_POOL_ADDRESS, AAVE_POOL_ABI, rpcProvider);
    const data = await pool.getUserAccountData(accountAddress);

    const totalDebtBase = BigInt(data[1]);
    const healthFactorRaw = BigInt(data[5]);

    // Si no hay deuda, el health factor es "sin deuda"
    if (totalDebtBase === 0n) {
      return {
        hasDebt: false,
        healthFactor: 999,
        totalDebtUsd: 0,
      };
    }

    // Si hay deuda, procesar el health factor normalmente
    const healthFactor = Number(healthFactorRaw) / 1e18;

    return {
      hasDebt: true,
      healthFactor,
      totalDebtUsd: Number(totalDebtBase) / 1e8, // Aave usa 8 decimales para USD
    };
  } catch (error) {
    return {
      hasDebt: false,
      healthFactor: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getHealthFactorNumber(
  wallet: string,
  provider?: JsonRpcProvider
): Promise<number> {
  const position = await checkAavePosition(wallet, provider);
  if (position.error) {
    console.error(`Error consultando Aave para ${wallet}:`, position.error);
    return 999;
  }
  if (position.healthFactor === null || position.healthFactor === undefined) {
    return 999;
  }
  return position.healthFactor;
}
