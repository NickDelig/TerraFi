import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Sparkles, TrendingDown, TrendingUp, Zap, Shirt, X } from "lucide-react";
import { useSnappi } from "@/lib/snappi/store";
import { fmtEur } from "@/lib/snappi/data";
import { DemoTag, Sheet } from "./ui";
import { cn } from "@/lib/utils";

/* Mock AI layer: forecast + recommender. All values are demo data. */

export interface Swap {
  id: string;
  icon: typeof Shirt;
  from: string;
  to: string;
  text: string;
  perk: string;
  esgGain: number;
}

export const SWAPS: Swap[] = [
  { id: "fashion", icon: Shirt, from: "Fast Fashion Store", to: "EcoWear", text: "Swap 'Fast Fashion Store' for 'EcoWear' on your next purchase.", perk: "Earn 2.5× Snappies and gain +10 ESG points.", esgGain: 10 },
  { id: "energy", icon: Zap, from: "Shell", to: "GreenPower Grid", text: "Switch your energy bill to 'GreenPower Grid'.", perk: "Maintain your Tier-1 Savings Rate.", esgGain: 15 },
];

interface AiCtx {
  monthEndDrop: boolean;
  setMonthEndDrop: (v: boolean) => void;
  applied: string[];
  applySwap: (id: string) => void;
  celebrate: Swap | null;
  closeCelebrate: () => void;
  alert: boolean;
  setAlert: (v: boolean) => void;
  resetAi: () => void;
}
const Ctx = createContext<AiCtx | null>(null);
export const useAi = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAi outside provider");
  return c;
};

export function AiProvider({ children }: { children: ReactNode }) {
  const [monthEndDrop, setMonthEndDrop] = useState(false);
  const [applied, setApplied] = useState<string[]>([]);
  const [celebrate, setCelebrate] = useState<Swap | null>(null);
  const [alert, setAlert] = useState(false);
  const value: AiCtx = {
    monthEndDrop,
    setMonthEndDrop: (v) => { setMonthEndDrop(v); if (v) setApplied([]); },
    applied,
    applySwap: (id) => {
      setApplied((a) => (a.includes(id) ? a : [...a, id]));
      setCelebrate(SWAPS.find((s) => s.id === id) ?? null);
      setAlert(false);
    },
    celebrate,
    closeCelebrate: () => setCelebrate(null),
    alert,
    setAlert,
    resetAi: () => { setMonthEndDrop(false); setApplied([]); },
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      <SwapAlertSheet />
      <CelebrateSheet />
    </Ctx.Provider>
  );
}

function useForecast() {
  const { score, paymentsBalance } = useSnappi();
  const { monthEndDrop, applied } = useAi();
  return useMemo(() => {
    const drop = monthEndDrop ? 60 : 15;
    const gain = SWAPS.filter((s) => applied.includes(s.id)).reduce((a, s) => a + s.esgGain, 0);
    const net = gain - drop;
    const spend = monthEndDrop ? 1450 : 820; // mock recurring payments
    const data = Array.from({ length: 31 }, (_, d) => {
      const t = d / 30;
      const wobble = Math.sin(d * 1.3) * 3;
      const salary = d >= 25 ? 1650 : 0; // mock salary day
      return {
        day: d === 0 ? "Today" : `D${d}`,
        balance: Math.round(paymentsBalance - spend * t + salary + wobble * 10),
        esg: Math.round(score + net * (monthEndDrop ? Math.pow(t, 0.7) : t) + wobble),
      };
    });
    return { data, net, end: data[30]!, drop };
  }, [score, paymentsBalance, monthEndDrop, applied]);
}

export function ForecastToggle({ mode, onChange }: { mode: "current" | "forecast"; onChange: (m: "current" | "forecast") => void }) {
  return (
    <div className="relative mx-auto mt-5 grid w-fit grid-cols-2 rounded-full border border-border bg-card/70 p-1 text-xs font-semibold backdrop-blur">
      <span className={cn("absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-gradient-primary shadow-glow transition-transform duration-300", mode === "forecast" && "translate-x-full")} />
      {(["current", "forecast"] as const).map((m) => (
        <button key={m} onClick={() => onChange(m)} className={cn("relative z-10 flex items-center justify-center gap-1 px-4 py-1.5 transition-colors", mode === m ? "text-primary-foreground" : "text-muted-foreground")}>
          {m === "forecast" && <Sparkles className="h-3 w-3" />}
          {m === "current" ? "Current" : "30-Day Forecast"}
        </button>
      ))}
    </div>
  );
}

export function ForecastPanel() {
  const { score } = useSnappi();
  const { monthEndDrop } = useAi();
  const f = useForecast();
  const down = f.net < 0;
  return (
    <div className="mx-4 mt-5 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <div className="rounded-3xl border border-border bg-card/70 p-4 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium tracking-wider text-muted-foreground">AI 30-DAY FORECAST</p>
          <DemoTag />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] text-muted-foreground">Projected balance</p>
            <p className="text-lg font-semibold tabular-nums text-primary-glow">{fmtEur(f.end.balance)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Projected ESG</p>
            <p className={cn("flex items-center gap-1 text-lg font-semibold tabular-nums", down ? "text-esg-low" : "text-esg-high")}>
              {f.end.esg}
              {down ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              <span className="text-xs">{f.net >= 0 ? "+" : ""}{f.net}</span>
            </p>
          </div>
        </div>
        <div className="mt-2 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={f.data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} interval={9} axisLine={false} tickLine={false} />
              <YAxis yAxisId="b" hide domain={["dataMin - 200", "dataMax + 200"]} />
              <YAxis yAxisId="e" hide orientation="right" domain={[score - 80, score + 40]} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 11 }}
                labelStyle={{ color: "var(--muted-foreground)" }}
                formatter={(v: number, n: string) => (n === "balance" ? [fmtEur(v), "Balance"] : [v, "ESG"])}
              />
              <Line yAxisId="b" type="monotone" dataKey="balance" stroke="var(--primary)" strokeWidth={2.5} dot={false} animationDuration={900} />
              <Line yAxisId="e" type="monotone" dataKey="esg" stroke={down ? "var(--esg-low)" : "var(--accent)"} strokeWidth={2.5} strokeDasharray="5 4" dot={false} animationDuration={900} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 flex justify-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-0.5 w-4 rounded bg-primary" />Projected Balance</span>
          <span className="flex items-center gap-1"><span className={cn("h-0.5 w-4 rounded", down ? "bg-esg-low" : "bg-accent")} />Projected ESG Score</span>
        </div>
      </div>

      <div className={cn("mt-3 flex gap-3 rounded-2xl border p-4 backdrop-blur-xl", down ? "border-esg-low/40 bg-esg-low/10" : "border-esg-high/40 bg-esg-high/10")}>
        <Sparkles className={cn("mt-0.5 h-4 w-4 shrink-0", down ? "text-esg-low" : "text-esg-high")} />
        <p className="text-xs leading-relaxed">
          <span className="font-semibold">AI Forecast: </span>
          {down
            ? monthEndDrop
              ? `Month-end alert: recurring low-ESG payments will drop your ESG score by ${-f.net} points, putting your ${"Tier-1"} loan discount and savings bonus at risk. Apply a Smart Swap below to fix it.`
              : `Based on your upcoming recurring payments, your ESG score will drop by ${-f.net} points, risking your Tier-1 loan discount. See recommendations below.`
            : `Great choice! With your Smart Swaps your ESG score is projected to rise by ${f.net} points and your Tier-1 benefits are protected.`}
        </p>
      </div>
    </div>
  );
}

function SwapCard({ s }: { s: Swap }) {
  const { applied, applySwap } = useAi();
  const done = applied.includes(s.id);
  const I = s.icon;
  return (
    <div className="relative w-[80%] shrink-0 snap-center overflow-hidden rounded-2xl border border-border bg-card/70 p-4 backdrop-blur-xl">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/25 blur-2xl" />
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary-glow"><I className="h-4 w-4" /></span>
        <span className="rounded-full bg-esg-low/15 px-2 py-0.5 text-[10px] font-semibold text-esg-low">Low-ESG: {s.from}</span>
      </div>
      <p className="mt-3 text-sm font-medium">{s.text}</p>
      <p className="mt-1 text-xs text-accent">{s.perk}</p>
      <button
        disabled={done}
        onClick={() => applySwap(s.id)}
        className={cn("mt-4 w-full rounded-full py-2.5 text-xs font-bold uppercase tracking-wider tap", done ? "bg-esg-high/15 text-esg-high" : "bg-gradient-primary text-primary-foreground shadow-glow")}
      >
        {done ? "✓ Swapped" : "Swap & Save"}
      </button>
    </div>
  );
}

export function SmartSwaps() {
  return (
    <>
      <div className="mb-3 mt-7 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-base font-semibold"><Sparkles className="h-4 w-4 text-primary-glow" />AI Smart Swaps</h2>
        <DemoTag />
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto no-scrollbar px-4">
        {SWAPS.map((s) => <SwapCard key={s.id} s={s} />)}
      </div>
    </>
  );
}

function SwapAlertSheet() {
  const { alert, setAlert, applySwap } = useAi();
  const s = SWAPS[0]!;
  if (!alert) return null;
  return (
    <div className="absolute inset-x-3 top-3 z-50 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="rounded-2xl border border-primary/40 bg-card/90 p-4 shadow-glow backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></span>
          <div className="flex-1">
            <p className="text-[10px] font-semibold tracking-wider text-primary-glow">SNAPPI AI · SMART GREEN SWAP</p>
            <p className="mt-1 text-sm font-medium">{s.text}</p>
            <p className="text-xs text-accent">{s.perk}</p>
          </div>
          <button aria-label="Dismiss" onClick={() => setAlert(false)} className="text-muted-foreground tap"><X className="h-4 w-4" /></button>
        </div>
        <button onClick={() => applySwap(s.id)} className="mt-3 w-full rounded-full bg-gradient-primary py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground tap">Swap & Save</button>
      </div>
    </div>
  );
}

function CelebrateSheet() {
  const { celebrate, closeCelebrate } = useAi();
  return (
    <Sheet open={!!celebrate} onClose={closeCelebrate} title="">
      {celebrate && (
        <div className="relative flex flex-col items-center overflow-hidden py-6 text-center">
          {Array.from({ length: 14 }).map((_, i) => (
            <span
              key={i}
              className="pointer-events-none absolute top-1/3 text-lg animate-in fade-in zoom-in-50 slide-in-from-bottom-10 duration-700 fill-mode-both"
              style={{ left: `${5 + ((i * 37) % 90)}%`, animationDelay: `${i * 60}ms`, transform: `translateY(${-((i * 23) % 80)}px)` }}
            >
              {i % 2 ? "🌿" : "✨"}
            </span>
          ))}
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-esg-high/15 shadow-leaf animate-in zoom-in">
            <svg viewBox="0 0 40 40" className="h-10 w-10"><path d="M10 21 l7 7 l14 -15" className="stroke-esg-high animate-check" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">Smart choice!</p>
          <p className="text-2xl font-semibold">Switched to {celebrate.to}</p>
          <span className="mt-4 rounded-full bg-esg-high/15 px-4 py-2 text-sm font-semibold text-esg-high animate-in fade-in slide-in-from-bottom-2 delay-200 fill-mode-both">+{celebrate.esgGain} projected ESG points</span>
          <p className="mt-4 text-xs text-muted-foreground">Your 30-day forecast has been updated. Demo data only.</p>
          <button onClick={closeCelebrate} className="mt-6 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground tap">Done</button>
        </div>
      )}
    </Sheet>
  );
}
