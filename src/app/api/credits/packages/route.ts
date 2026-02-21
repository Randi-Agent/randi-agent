import { getSubscriptionPlan, getCreditPackages } from "@/lib/credits/engine";

export async function GET() {
  return NextResponse.json({
    plan: getSubscriptionPlan(),
    packages: getCreditPackages(),
  });
}
