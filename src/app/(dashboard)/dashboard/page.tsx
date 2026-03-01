"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { useTokenPrice } from "@/hooks/useTokenPrice";
import { useSearchParams } from "next/navigation";

interface ChatSession {
  id: string;
  title: string;
  agent: { name: string; image: string };
  createdAt: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const { isSubscribed, subscription } = useCredits();
  const { priceUsd, marketCap, burnPercent, formatUsdCompact } = useTokenPrice();
  const [recentSessions, setRecentSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  // Fetch full profile and handle URL-based username
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user?.username) {
            setUsername(data.user.username);
          }
        }
      } catch (e) {
        console.error("Failed to fetch profile:", e);
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();

    // Redo username handling via URL
    const urlUsername = searchParams.get("set-username");
    if (urlUsername && urlUsername.length >= 3 && urlUsername.length <= 20) {
      setUsername(urlUsername.toLowerCase().replace(/[^a-z0-9-]/g, ""));
    }
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/chat/sessions")
      .then((res) => res.json())
      .then((data) => {
        setRecentSessions(data.sessions?.slice(0, 4) || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching sessions:", err);
        setLoading(false);
      });
  }, []);

  const handleSaveUsername = async () => {
    if (!username || username.length < 3) return;
    setSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (e) {
      console.error("Failed to save username:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/${username}`;
    navigator.clipboard.writeText(url);
    alert("Profile link copied to clipboard!");
  };

  const walletDisplay = user?.walletAddress
    ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
    : "User";

  const daysLeft = subscription.expiresAt
    ? Math.max(0, Math.ceil((new Date(subscription.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
      <div className="flex flex-col md:flex-row items-baseline justify-between gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gradient mb-2">
            Welcome back, {walletDisplay}
          </h1>
          <p className="text-muted-foreground font-medium">
            Your command center for high-autonomy agents.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          <span className="text-xs font-bold text-primary uppercase tracking-widest">System Operational</span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {/* Subscription Status */}
        <div className="glass-card rounded-3xl p-8 relative overflow-hidden group transition-all hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors"></div>
          <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] font-bold mb-4">Membership</p>
          {isSubscribed ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-success/20 rounded-2xl flex items-center justify-center">
                  <span className="text-2xl">✨</span>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white italic">PRO</h3>
                  <p className="text-xs text-success font-bold mt-0.5">
                    {daysLeft !== null ? `${daysLeft} days left` : "Active"}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-6 leading-relaxed">
                You have prioritized access to all premium models and tools.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center">
                  <span className="text-2xl">⚡️</span>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-muted-foreground">FREE</h3>
                  <p className="text-xs text-muted-foreground/60 font-bold mt-0.5">Metered Access</p>
                </div>
              </div>
              <Link href="/credits" className="mt-8 block w-full text-center py-3 bg-white text-black hover:bg-white/90 rounded-2xl text-sm font-black transition-all transform hover:-translate-y-1">
                UPGRADE TO PRO
              </Link>
            </>
          )}
        </div>

        {/* Model Access */}
        <div className="glass-card rounded-3xl p-8 transition-all hover:scale-[1.02]">
          <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] font-bold mb-4">AI Arsenal</p>
          <div className="flex flex-col gap-4 mt-2">
            {[
              { name: "Llama 3.3 70B", status: "Active" },
              { name: "Gemini 2.0 Flash", status: "Active" },
              { name: "DeepSeek R1", status: "Active" },
            ].map((m) => (
              <div key={m.name} className="flex items-center justify-between group">
                <span className="text-sm font-medium group-hover:text-primary transition-colors">{m.name}</span>
                <span className="text-[10px] px-2 py-0.5 bg-success/20 text-success rounded-full font-bold uppercase">{m.status}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 pt-6 border-t border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-bold italic">Power Index</span>
              <span className="text-xs font-black">98.4%</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-accent w-[98.4%]"></div>
            </div>
          </div>
        </div>

        {/* RANDI Market Cap */}
        <div className="glass-card rounded-3xl p-8 highlight-border transition-all hover:scale-[1.02] border-primary/30 shadow-[0_0_40px_-15px_rgba(109,40,217,0.3)]">
          <p className="text-xs text-primary uppercase tracking-[0.2em] font-bold mb-4">$RANDI Market Info</p>
          <div className="flex flex-col mt-2">
            <span className="text-4xl font-black tracking-tighter">
              {marketCap !== null ? formatUsdCompact(marketCap) : "—"}
            </span>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground font-mono">
                {priceUsd ? `$${priceUsd.toFixed(8)}` : "—"}
              </span>
              <span className="text-xs text-success font-bold flex items-center">
                <span className="mr-0.5">↑</span>
                {burnPercent}% Burned
              </span>
            </div>
          </div>
          <a
            href="https://dexscreener.com/solana/GmnoShpt5vyGwZLyPYsBah2vxPUAfvw6fKSLbBa2XpFy"
            target="_blank"
            rel="noreferrer"
            className="mt-8 block w-full text-center py-3 bg-primary hover:bg-primary/90 text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-primary/30 transform hover:-translate-y-1"
          >
            BUY $RANDI
          </a>
        </div>
      </div>

      {/* Profile & Branded URL */}
      <div className="glass-card rounded-3xl p-8 mb-12 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-8 items-center">
          <div className="flex-1 w-full">
            <h2 className="text-2xl font-black mb-2 italic">Profile URL</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              Establish your brand. Your agents will be accessible via your custom username URL.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1 group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground font-mono text-xs">
                  randi.chat/
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="yourname"
                  className="w-full pl-24 pr-4 py-3 bg-black/40 border border-border/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-mono text-sm"
                  minLength={3}
                  maxLength={20}
                />
              </div>
              <button
                onClick={handleSaveUsername}
                disabled={saving || username.length < 3}
                className="px-8 py-3 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black disabled:opacity-50 transition-all text-sm italic"
              >
                {saving ? "SAVING..." : saved ? "READY" : "SET HANDLE"}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-3 font-bold uppercase tracking-widest pl-4">
              3-20 Characters • Alphanumeric & Hyphens
            </p>
          </div>

          <div className="w-full lg:w-72 p-6 bg-black/60 rounded-2xl border border-border/50 backdrop-blur-xl">
            <p className="text-[10px] text-muted-foreground font-bold mb-3 uppercase tracking-tighter">Your Public Gateway</p>
            <div className="bg-muted/30 p-3 rounded-xl border border-white/5 font-mono text-xs truncate text-primary mb-4 select-all">
              randi.chat/{username || "..."}
            </div>
            <button
              onClick={handleCopyLink}
              disabled={!username}
              className="w-full py-2 bg-muted hover:bg-muted/80 text-xs font-bold rounded-xl transition-colors disabled:opacity-30"
            >
              COPY LINK
            </button>
          </div>
        </div>
      </div>

      {/* Recent Conversations */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-black italic tracking-tighter">History</h2>
          <Link href="/chat" className="text-xs text-primary hover:text-white bg-primary/10 hover:bg-primary px-4 py-2 rounded-full font-black transition-all">
            VIEW FULL ARCHIVE
          </Link>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 bg-card/50 animate-pulse rounded-2xl border border-border/50"></div>
            ))}
          </div>
        ) : recentSessions.length === 0 ? (
          <div className="glass-card rounded-3xl p-16 text-center border-dashed border-border/50">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl text-primary animate-bounce">💬</span>
            </div>
            <p className="text-muted-foreground mb-8 text-lg font-medium">Your agent history is empty. Deploy your first vision.</p>
            <Link
              href="/agents"
              className="px-10 py-4 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black transition-all shadow-xl shadow-primary/30 transform hover:-translate-y-1 block md:inline-block"
            >
              INITIALIZE AGENT
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {recentSessions.map((session) => (
              <Link
                key={session.id}
                href={`/chat/${session.id}`}
                className="group relative glass-card rounded-2xl p-6 transition-all hover:translate-x-1 hover:border-primary/50 overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                  <span className="text-4xl font-black italic select-none">#{session.id.slice(-3)}</span>
                </div>
                <h3 className="font-extrabold text-xl mb-2 group-hover:text-primary transition-colors pr-10">{session.title}</h3>
                <div className="flex items-center justify-between mt-6">
                  <div className="flex items-center gap-2">
                    {session.agent.image && (
                      <img src={session.agent.image} alt="" className="w-5 h-5 rounded-full object-cover" />
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary italic">
                      {session.agent.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-bold">{new Date(session.createdAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
