import { ethers } from "ethers";
import { sendDiscordAlert } from "./discord";

// Direcciones oficiales de Curvance en Monad Mainnet
const PROTOCOL_READER = "0x2677738657F27e1A3591E00AD7E5a78807688C08";
const RPC_URL = "https://rpc.monad.xyz";

// Lista de MarketManagers de Curvance en Monad (los principales por TVL)
const MARKET_MANAGERS = [
  "0xb3E9E0134354cc91b7FB9F9d6C3ab0dE7854BB49", // WETH | USDC
  "0xE1C24B2E93230FBe33d32Ba38ECA3218284143e2", // shMON | WMON
  "0x5EA0a1Cf3501C954b64902c5e92100b8A2CaB1Ac", // aprMON | WMON
  "0xe5970cDB1916B2cCF6185C86C174EEE2d330D05B", // sMON | WMON
  "0xb00aFF53a4Df2b4E2f97a3d9ffaDb55564C8E42F", // gMON | WMON
  "0x05e70717fA8BD0F21a9F826d093d99f6Da4f1554", // WMON | AUSD
  "0xa6A2A92F126b79Ee0804845ee6B52899b4491093", // WMON | USDC
  "0x01C4a0d396EFE982B1B103BE9910321d34e1aEA9", // WBTC | USDC
  "0xBc4cd7bbd8d38027A88838B88BA04561FA778C35", // eBTC | WBTC
];

// ABI del ProtocolReader de Curvance
const PROTOCOL_READER_ABI = [
  "function liquidationValuesOf(address mm, address account, bool isAuction) external view returns (uint256 cSoft, uint256 cHard, uint256 debt, uint256 lFactor, bool errorHit)",
];

const provider = new ethers.JsonRpcProvider(RPC_URL);

// Umbrales de lFactor (WAD = 1e18)
// lFactor == 0 → sin liquidación
// 1 <= lFactor < WAD → soft liquidation (peligro)
// lFactor == WAD → hard liquidation (crítico)
const DANGER_THRESHOLD = ethers.parseUnits("0.5", 18); // 50% hacia hard liquidation
const CRITICAL_THRESHOLD = ethers.parseUnits("0.8", 18); // 80% hacia hard liquidation

export async function checkCurvanceHealth(userAddress: string): Promise<void> {
  const reader = new ethers.Contract(PROTOCOL_READER, PROTOCOL_READER_ABI, provider);
  let anyPositionFound = false;

  for (const marketManager of MARKET_MANAGERS) {
    try {
      const result = await reader.liquidationValuesOf(marketManager, userAddress, false);
      
      const debt = result[2];
      const lFactor = result[3];
      const errorHit = result[4];

      // Si no hay deuda, saltar
      if (debt === 0n) {
        continue;
      }

      anyPositionFound = true;
      const hfFormatted = ethers.formatUnits(lFactor, 18);
      const marketShort = marketManager.slice(0, 10);

      console.log(`[Curvance][${userAddress}][${marketShort}...] lFactor: ${hfFormatted}, debt: ${ethers.formatUnits(debt, 18)}`);

      if (errorHit) {
        console.log(`[Curvance][${userAddress}][${marketShort}...] Error en oracle, saltando`);
        continue;
      }

      if (lFactor >= CRITICAL_THRESHOLD) {
        await sendDiscordAlert(
          `🚨 **CRÍTICO en Curvance** 🚨\n\n` +
          `Wallet: \`${userAddress}\`\n` +
          `Mercado: \`${marketShort}...\`\n` +
          `lFactor: **${hfFormatted}**\n` +
          `Acción requerida: Revisa tu posición AHORA.`
        );
      } else if (lFactor >= DANGER_THRESHOLD) {
        await sendDiscordAlert(
          `⚠️ **Alerta en Curvance**\n\n` +
          `Wallet: \`${userAddress}\`\n` +
          `Mercado: \`${marketShort}...\`\n` +
          `lFactor: **${hfFormatted}**\n` +
          `Considera añadir margen.`
        );
      }
    } catch (marketError) {
      // Si el mercado no existe o no hay posición, saltar silenciosamente
      continue;
    }
  }

  if (!anyPositionFound) {
    console.log(`[Curvance][${userAddress}] Sin posiciones activas en Curvance`);
  }
}
