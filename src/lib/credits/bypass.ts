const BYPASS_WALLETS = [
  "0xd7BA546746860E8A8347D4C63E02131F0d0683cf",
  "DZeJeJWherrR8gtpyrDQ4mGfW1LHuK5gETvFWt6rqdzS",
  "dev-bypass-wallet",
];

const BYPASS_CREDITS = 1000000;

export function isBypassWallet(wallet: string): boolean {
  return BYPASS_WALLETS.includes(wallet);
}

export function getBypassCredits(): number {
  return BYPASS_CREDITS;
}

export function getCreditsWithBypass(wallet: string, actualBalance: number): number {
  if (isBypassWallet(wallet)) {
    return BYPASS_CREDITS;
  }
  return actualBalance;
}
