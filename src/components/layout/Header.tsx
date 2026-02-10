"use client";

import Link from "next/link";
import { ConnectButton } from "@/components/wallet/ConnectButton";

export function Header() {
  return (
    <header className="border-b border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-foreground">
          Agent Platform
        </Link>
        <ConnectButton />
      </div>
    </header>
  );
}
