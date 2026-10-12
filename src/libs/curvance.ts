// src/libs/curvance.ts
import { ethers } from 'ethers';

const PROTOCOL_READER = '0xC5E6DD26095Cc1fa2369f7885dF263e150228D8b';
const RPC_URL = process.env.CURVANCE_RPC_URL || 'https://rpc.monad.xyz';

// Market Managers de Curvance en Monad (misma lista que la extensión)
const MARKET_MANAGERS = [
  '0xb3E9E0134354cc91b7FB9F9d6C3ab0dE7854BB49',
  '0xE1C24B2E93230FBe33d32Ba38ECA3218284143e2',
  '0x5EA0a1Cf3501C954b64902c5e92100b8A2CaB1Ac',
  '0xe5970cDB1916B2cCF6185C86C174EEE2d330D05B',
  '0xb00aFF53a4Df2b4E2f97a3d9ffaDb55564C8E42F',
  '0x05e70717fA8BD0F21a9F826d093d99f6Da4f1554',
  '0xa6A2A92F126b79Ee0804845ee6B52899b4491093',
  '0x01C4a0d396EFE982B1B103BE9910321d34e1aEA9',
  '0xBc4cd7bbd8d38027A88838B88BA04561FA778C35',
];

const PROTOCOL_READER_ABI = [
  'function liquidationValuesOf(address mm, address account, bool isAuction) external view returns (uint256 cSoft, uint256 cHard, uint256 debt, uint256 lFactor, bool errorHit)',
];

// Nombres de mercado para mostrar en UI
const MARKET_NAMES: Record<string, string> = {
  '0xb3E9E0134354cc91b7FB9F9d6C3ab0dE7854BB49': 'muBOND → AUSD',
  '0xE1C24B2E93230FBe33d32Ba38ECA3218284143e2': 'loAZND → AUSD',
  '0x5EA0a1Cf3501C954b64902c5e92100b8A2CaB1Ac': 'aprmon → WMON',
  '0xe5970cDB1916B2cCF6185C86C174EEE2d330D05B': 'sMON → WMON',
  '0xb00aFF53a4Df2b4E2f97a3d9ffaDb55564C8E42F': 'sAUSD → AUSD',
  '0x05e70717fA8BD0F21a9F826d093d99f6Da4f1554': 'WMON ⇄ AUSD',
  '0xa6A2A92F126b79Ee0804845ee6B52899b4491093': 'WBTC ⇄ USDC',
  '0x01C4a0d396EFE982B1B103BE9910321d34e1aEA9': 'WETH ⇄ USDC',
  '0xBc4cd7bbd8d38027A88838B88BA04561FA778C35': 'eBTC ⇄ WBTC',
};

export interface CurvancePosition {
  hasDebt: boolean;
  marketName?: string;
  marketManager?: string;
  debtUsd?: number;
  cSoft?: number;
  cHard?: number;
  ratio?: number;
  riskLevel?: number; // 0 = seguro, 0-0.5 precaucion, 0.5-1 critico, >=1 liquidacion
  error?: string;
}

export async function checkCurvancePosition(
  accountAddress: string,
  provider?: ethers.JsonRpcProvider
): Promise<CurvancePosition> {
  try {
    const rpcProvider = provider || new ethers.JsonRpcProvider(RPC_URL);
    const reader = new ethers.Contract(PROTOCOL_READER, PROTOCOL_READER_ABI, rpcProvider);

    // Buscar en todos los market managers si hay deuda
    for (const mm of MARKET_MANAGERS) {
      try {
        const result = await reader.liquidationValuesOf(mm, accountAddress, false);
        const cSoftRaw = result[0];  // umbral liquidacion suave
        const cHardRaw = result[1];  // umbral liquidacion dura
        const debtRaw = result[2];   // deuda en USD (18 decimals)
        const errorHit = result[4];

        // Si errorHit es true, saltar
        if (errorHit) continue;

        if (debtRaw > 0n) {
          // Convertir a números
          const debtUsd = parseFloat(ethers.formatUnits(debtRaw, 18));
          const cSoft = parseFloat(ethers.formatUnits(cSoftRaw, 18));
          const cHard = parseFloat(ethers.formatUnits(cHardRaw, 18));

          // ratio = debt / cSoft
          // - < 0.5   → SEGURO
          // - 0.5-0.9 → PRECAUCIÓN
          // - 0.9-1.0 → CRÍTICO
          // - >= 1.0  → LIQUIDACIÓN (pasó el soft threshold)
          const ratio = cSoft > 0 ? debtUsd / cSoft : 0;

          let riskLevel: number;
          if (ratio < 0.5) {
            riskLevel = 0;       // SEGURO
          } else if (ratio < 0.9) {
            riskLevel = 0.25;    // PRECAUCIÓN
          } else if (ratio < 1.0) {
            riskLevel = 0.75;    // CRÍTICO
          } else {
            riskLevel = 1.0;     // LIQUIDACIÓN
          }

          return {
            hasDebt: true,
            marketName: MARKET_NAMES[mm] || mm,
            marketManager: mm,
            debtUsd,
            cSoft,
            cHard,
            ratio,
            riskLevel,
          };
        }
      } catch (e) {
        // Sin posición en este mercado, seguir con el siguiente
        continue;
      }
    }

    // No se encontró deuda en ningún mercado
    return { hasDebt: false };
  } catch (error: any) {
    console.error(`[Curvance] Error consultando ${accountAddress}:`, error);
    return {
      hasDebt: false,
      error: error.message || 'Error desconocido',
    };
  }
}
