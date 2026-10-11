// src/libs/curvance.ts
import { setupChain } from 'curvance';
import { JsonRpcProvider } from 'ethers';

export interface CurvancePosition {
  hasDebt: boolean;
  marketName?: string;
  debtUsd?: number;
  riskLevel?: number; // lFactor: 0 = seguro, >0 = riesgo, 1e18 = liquidación dura
  error?: string;
}

const CHAIN = 'monad-mainnet';
const WAD = 10n ** 18n;

export async function checkCurvancePosition(
  accountAddress: string,
  provider?: JsonRpcProvider
): Promise<CurvancePosition> {
  try {
    const rpcProvider = provider || new JsonRpcProvider(
      process.env.CURVANCE_RPC_URL || 'https://rpc.monad.xyz'
    );

    const { markets, reader } = await setupChain(CHAIN, rpcProvider);

    for (const market of markets) {
      await market.reloadUserData(accountAddress);

      if (market.userDebt && market.userDebt.gt(0)) {
        // Usar ProtocolReader.liquidationValuesOf para monitoreo de liquidación no-auction
        // Devuelve (cSoft, cHard, debt, lFactor, errorCodeHit)
        const result = await reader.liquidationValuesOf(
          market.address,
          accountAddress,
          false
        );

        const debt = result[2];
        const lFactor = result[3];

        return {
          hasDebt: true,
          marketName: market.name || market.address,
          debtUsd: debt ? Number(debt) / 1e18 : 0,
          riskLevel: lFactor ? Number(lFactor) / Number(WAD) : 0,
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
