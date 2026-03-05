"use client";

import { PaymentExplainer } from "@/components/dashboard/PaymentExplainer";

export default function HowItWorksPage() {
    return (
        <div className="max-w-6xl mx-auto px-4 py-10">
            <div className="mb-12">
                <h1 className="text-5xl font-black italic tracking-tighter text-gradient mb-4 uppercase">
                    How it Works
                </h1>
                <p className="text-xl text-muted-foreground font-medium max-w-2xl leading-relaxed">
                    Randi is a state-of-the-art orchestration layer that combines deep domain knowledge with the ability to spend money and trigger actions across any network.
                </p>
            </div>

            <PaymentExplainer />

            <footer className="mt-20 pt-10 border-t border-border/50 text-center">
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.3em]">
                    Randi Agent Platform • Powered by Solana & Composio
                </p>
            </footer>
        </div>
    );
}
