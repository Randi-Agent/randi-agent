import { prisma } from "@/lib/db/prisma";

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  tokenAmount: bigint;
  tokenAmountDisplay: string;
}

export function getCreditPackages(): CreditPackage[] {
  const decimals = Number(process.env.TOKEN_DECIMALS) || 9;
  const divisor = BigInt(10 ** decimals);

  return [
    {
      id: "small",
      name: "Starter",
      credits: Number(process.env.CREDITS_PACKAGE_SMALL_AMOUNT) || 100,
      tokenAmount: BigInt(process.env.CREDITS_PACKAGE_SMALL_TOKENS || "1000000000"),
      tokenAmountDisplay: `${Number(BigInt(process.env.CREDITS_PACKAGE_SMALL_TOKENS || "1000000000")) / Number(divisor)}`,
    },
    {
      id: "medium",
      name: "Pro",
      credits: Number(process.env.CREDITS_PACKAGE_MEDIUM_AMOUNT) || 500,
      tokenAmount: BigInt(process.env.CREDITS_PACKAGE_MEDIUM_TOKENS || "4500000000"),
      tokenAmountDisplay: `${Number(BigInt(process.env.CREDITS_PACKAGE_MEDIUM_TOKENS || "4500000000")) / Number(divisor)}`,
    },
    {
      id: "large",
      name: "Enterprise",
      credits: Number(process.env.CREDITS_PACKAGE_LARGE_AMOUNT) || 1200,
      tokenAmount: BigInt(process.env.CREDITS_PACKAGE_LARGE_TOKENS || "10000000000"),
      tokenAmountDisplay: `${Number(BigInt(process.env.CREDITS_PACKAGE_LARGE_TOKENS || "10000000000")) / Number(divisor)}`,
    },
  ];
}

export function getPackageById(id: string): CreditPackage | undefined {
  return getCreditPackages().find((p) => p.id === id);
}

export async function deductCredits(
  userId: string,
  amount: number,
  description: string,
  containerId?: string
): Promise<boolean> {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    });

    if (!user || user.creditBalance < amount) {
      return false;
    }

    await tx.user.update({
      where: { id: userId },
      data: { creditBalance: { decrement: amount } },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        type: "USAGE",
        status: "CONFIRMED",
        amount: -amount,
        containerId,
        description,
      },
    });

    return true;
  });
}

export async function addCredits(
  userId: string,
  amount: number,
  txSignature: string,
  tokenAmount: bigint,
  memo: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { creditBalance: { increment: amount } },
    });

    await tx.creditTransaction.updateMany({
      where: { memo, userId, status: "PENDING" },
      data: {
        status: "CONFIRMED",
        txSignature,
        tokenAmount,
      },
    });
  });
}
