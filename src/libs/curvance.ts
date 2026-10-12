// src/libs/curvance.ts
import { setupChain } from 'curvance';
import { JsonRpcProvider } from 'ethers';

export interface CurvancePosition {
  hasDebt: boolean;
  marketName?: string;
  debtUsd?: number;
  error?: string;
}

const CHAIN = 'monad-mainnet';

export async function checkCurvancePosition(
  accountAddress: string,
  provider?: JsonRpcProvider
): Promise<CurvancePosition> {
  try {
    const rpcProvider = provider || new JsonRpcProvider(
      process.env.CURVANCE_RPC_URL || 'https://rpc.monad.xyz'
    );

    const { markets } = await setupChain(CHAIN, rpcProvider);

    for (const market of markets) {
      await market.reloadUserData(accountAddress);

      if (market.userDebt && market.userDebt.gt(0)) {
        return {
          hasDebt: true,
          marketName: market.name || market.address,
          debtUsd: Number(market.userDebt.toString()),
        };
      }
    }

    return { hasDebt: false };
  } catch (error: any) {
    console.error(`[Curvance] Error consultando ${accountAddress}:`, error);
    return {
      hasDebt: false,
      error: error.message || 'Error desconocido',
    };
  }
}
