import { PlanType } from "./payment";

interface UserPlan {
  userId: string;
  plan: PlanType;
  wallets: string[];
  expiresAt: number;
}

// Base de datos en memoria (para el MVP)
// En produccion, esto iria a una base de datos real
const users = new Map<string, UserPlan>();

export function getUserPlan(userId: string): UserPlan {
  if (!users.has(userId)) {
    users.set(userId, {
      userId,
      plan: "free",
      wallets: [],
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 dias
    });
  }
  return users.get(userId)!;
}

export function upgradePlan(userId: string, plan: PlanType): void {
  const user = getUserPlan(userId);
  user.plan = plan;
  user.expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  users.set(userId, user);
}

export function addWalletToUser(userId: string, wallet: string): boolean {
  const user = getUserPlan(userId);
  if (!user.wallets.includes(wallet)) {
    user.wallets.push(wallet);
    users.set(userId, user);
    return true;
  }
  return false;
}

export function removeWalletFromUser(userId: string, wallet: string): void {
  const user = getUserPlan(userId);
  user.wallets = user.wallets.filter((w) => w !== wallet);
  users.set(userId, user);
}

export function getUserWallets(userId: string): string[] {
  return getUserPlan(userId).wallets;
}
