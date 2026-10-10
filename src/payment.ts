import { x402HTTPClient } from "@x402/evm";
import { createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monad } from "viem/chains";

// Direccion de cobro (tu billetera de tesoreria)
const PAY_TO = process.env.X402_PAY_TO || "";
const FACILITATOR_URL = "https://x402-facilitator.molandak.org";
const USDC_ADDRESS = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603";

// Planes de suscripcion
export const PLANS = {
  free: { maxWallets: 1, price: "0" },
  premium: { maxWallets: 5, price: "0.50" },
  pro: { maxWallets: 999, price: "2.00" },
};

export type PlanType = keyof typeof PLANS;

// Verifica si el usuario puede anadir mas wallets segun su plan
export function canAddWallet(currentCount: number, plan: PlanType): boolean {
  return currentCount < PLANS[plan].maxWallets;
}

// Inicia el flujo de pago x402
export async function requestPayment(plan: PlanType): Promise<{
  success: boolean;
  paymentUrl?: string;
  error?: string;
}> {
  if (!PAY_TO) {
    return { success: false, error: "X402_PAY_TO no configurado" };
  }

  const price = PLANS[plan].price;

  if (price === "0") {
    return { success: true };
  }

  try {
    // El facilitador genera la URL de pago
    const amount = parseUnits(price, 6); // USDC tiene 6 decimales

    const paymentRequest = {
      payTo: PAY_TO,
      amount: amount.toString(),
      asset: USDC_ADDRESS,
      network: "eip155:143", // Monad Mainnet
      plan,
    };

    // En produccion, esto se enviaria al facilitador y devolveria una URL de pago
    console.log(`[x402] Solicitud de pago: ${price} USDC para plan ${plan}`);
    console.log(`[x402] Datos:`, paymentRequest);

    return {
      success: false,
      paymentUrl: `${FACILITATOR_URL}/pay?amount=${amount}&to=${PAY_TO}&plan=${plan}`,
    };
  } catch (error) {
    console.error("[x402] Error:", error);
    return { success: false, error: "Error generando pago" };
  }
}

// Verifica un pago con el facilitador
export async function verifyPayment(txHash: string): Promise<boolean> {
  try {
    const response = await fetch(`${FACILITATOR_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        txHash,
        payTo: PAY_TO,
      }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    return data.verified === true;
  } catch (error) {
    console.error("[x402] Error verificando pago:", error);
    return false;
  }
}
