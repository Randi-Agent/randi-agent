/**
 * Token-Gating Library
 * 
 * Handles staking tier logic for premium model access via $RANDI staking.
 * Tiers: NONE, BRONZE, SILVER, GOLD
 */

// Staking tier thresholds in $RANDI tokens (raw units, assuming 9 decimals)
export const STAKING_TIERS = {
    NONE: BigInt(0),
    BRONZE: BigInt(1000) * BigInt(1e9),    // 1000 $RANDI
    SILVER: BigInt(10000) * BigInt(1e9),   // 10000 $RANDI  
    GOLD: BigInt(100000) * BigInt(1e9),    // 100000 $RANDI
} as const;

export type StakingLevel = keyof typeof STAKING_TIERS;

// $RANDI token mint address (Pump.fun)
export const RANDI_TOKEN_MINT = process.env.RANDI_TOKEN_MINT || "GmnoShpt5vyGwZLyPYsBah2vxPUAfvw6fKSLbBa2XpFy";

// Token decimals
export const RANDI_TOKEN_DECIMALS = 9;

/**
 * Get the staking tier based on staked amount
 */
export function getStakingLevel(stakedAmount: bigint): StakingLevel {
    if (stakedAmount >= STAKING_TIERS.GOLD) return "GOLD";
    if (stakedAmount >= STAKING_TIERS.SILVER) return "SILVER";
    if (stakedAmount >= STAKING_TIERS.BRONZE) return "BRONZE";
    return "NONE";
}

/**
 * Get the required amount for a specific tier
 */
export function getTierThreshold(tier: StakingLevel): bigint {
    return STAKING_TIERS[tier];
}

/**
 * Get the next tier above the current one
 */
export function getNextTier(currentLevel: StakingLevel): StakingLevel | null {
    const tierOrder: StakingLevel[] = ["NONE", "BRONZE", "SILVER", "GOLD"];
    const currentIndex = tierOrder.indexOf(currentLevel);
    if (currentIndex === -1 || currentIndex === tierOrder.length - 1) return null;
    return tierOrder[currentIndex + 1];
}

/**
 * Calculate progress to next tier (0-100)
 */
export function getTierProgress(stakedAmount: bigint): number {
    const currentLevel = getStakingLevel(stakedAmount);
    const currentThreshold = STAKING_TIERS[currentLevel];

    if (currentLevel === "GOLD") return 100;

    const nextTier = getNextTier(currentLevel);
    if (!nextTier) return 100;

    const nextThreshold = STAKING_TIERS[nextTier];
    const range = nextThreshold - currentThreshold;

    if (range <= BigInt(0)) return 100;

    const progress = stakedAmount - currentThreshold;
    const percentage = (Number(progress) / Number(range)) * 100;

    return Math.min(100, Math.max(0, Math.round(percentage)));
}

/**
 * Get amount needed to reach next tier
 */
export function getAmountToNextTier(stakedAmount: bigint): bigint {
    const currentLevel = getStakingLevel(stakedAmount);
    const nextTier = getNextTier(currentLevel);

    if (!nextTier) return BigInt(0);

    const nextThreshold = STAKING_TIERS[nextTier];
    const needed = nextThreshold - stakedAmount;

    return needed > BigInt(0) ? needed : BigInt(0);
}

/**
 * Format token amount for display
 */
export function formatTokenAmount(amount: bigint, decimals: number = RANDI_TOKEN_DECIMALS): string {
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = amount / divisor;
    const fraction = amount % divisor;

    const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, 2);
    if (fractionStr === "00" || fractionStr === "0") {
        return whole.toLocaleString();
    }

    return `${whole.toLocaleString()}.${fractionStr}`;
}

/**
 * Check if a user can access a premium model based on their staking level
 */
export function canAccessPremiumModel(stakingLevel: StakingLevel, requiredLevel: StakingLevel): boolean {
    const tierOrder: StakingLevel[] = ["NONE", "BRONZE", "SILVER", "GOLD"];
    const userTierIndex = tierOrder.indexOf(stakingLevel);
    const requiredTierIndex = tierOrder.indexOf(requiredLevel);

    return userTierIndex >= requiredTierIndex;
}

/**
 * Premium models that require staking
 */
export const PREMIUM_MODELS = {
    // OpenAI o1 models
    "o1": "SILVER",
    "o1-mini": "SILVER",
    "o1-preview": "SILVER",
    // Anthropic Claude 3.5 Sonnet
    "anthropic/claude-3.5-sonnet": "SILVER",
    // Gold tier exclusive models could go here
    "o1-pro": "GOLD",
} as const;

/**
 * Get the required staking level for a model
 */
export function getModelRequiredStakingLevel(model: string): StakingLevel | null {
    // Check exact matches
    if (model in PREMIUM_MODELS) {
        return PREMIUM_MODELS[model as keyof typeof PREMIUM_MODELS];
    }

    // Check prefix matches (e.g., "o1-" prefix)
    for (const [modelPrefix, tier] of Object.entries(PREMIUM_MODELS)) {
        if (model.startsWith(modelPrefix)) {
            return tier;
        }
    }

    return null;
}

/**
 * Check if a model is premium (requires staking)
 */
export function isPremiumModel(model: string): boolean {
    return getModelRequiredStakingLevel(model) !== null;
}

/**
 * Validate if user can use the requested model
 */
export function validateModelAccess(
    model: string,
    userStakingLevel: StakingLevel
): { allowed: boolean; reason?: string } {
    const requiredLevel = getModelRequiredStakingLevel(model);

    if (!requiredLevel) {
        // Not a premium model, allow access
        return { allowed: true };
    }

    if (canAccessPremiumModel(userStakingLevel, requiredLevel)) {
        return { allowed: true };
    }

    const tierNames: Record<StakingLevel, string> = {
        NONE: "No staking",
        BRONZE: "BRONZE tier (1,000 $RANDI)",
        SILVER: "SILVER tier (10,000 $RANDI)",
        GOLD: "GOLD tier (100,000 $RANDI)",
    };

    return {
        allowed: false,
        reason: `This model requires ${tierNames[requiredLevel]} staking. Your current tier is ${tierNames[userStakingLevel]}.`,
    };
}
