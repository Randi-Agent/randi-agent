import { NextResponse } from "next/server";
import { getSubscriptionPlan, getCreditPackages } from "@/lib/credits/engine";

export async function GET() {
  return NextResponse.json({
    plan: getSubscriptionPlan(),
    packages: getCreditPackages(),
  });
}
