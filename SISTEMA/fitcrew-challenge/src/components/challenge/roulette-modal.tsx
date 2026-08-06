import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { X, Sparkles, Trophy, Frown } from "lucide-react";
import { PRIZES, type Prize } from "@/lib/roulette.functions";
import { RouletteHowItWorks } from "./roulette-how-it-works";

type WonPrize = {
  key: string;
  label: string;
  tier: "coin" | "points" | "troll";
  points: number;
  emoji?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** true = spin real. false = quebrada (não elegível). */
  eligible: boolean;
  countedDays?: number;
  requiredDays?: number;
  /** Prêmio resolvido pelo backend (null enquanto gira). */
  prize: WonPrize | null;
  /** Dispara o spin no servidor e volta com o prêmio. */
  onSpin: () => Promise<void>;
};

const WHEEL_ITEMS = PRIZES;

function fireConfetti() {
  const end = Date.now() + 1200;
  const colors = ["#f97316", "#facc15", "#fb923c", "#f59e0b", "#ffffff"];
  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors,
      scalar: 0.9,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors,
      scalar: 0.9,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export function RouletteModal({
  open,
  onClose,
  eligible,
  countedDays = 0,
  requiredDays = 0,
  prize,
  onSpin,
}: Props) {
  const [phase, setPhase] = useState<"idle" | "spinning" | "revealed">("idle");
  const [offset, setOffset] = useState(0);
  const itemH = 72; // altura de cada item vertical
  const spinLockRef = useRef(false);

  const winnerIndex = useMemo(() => {
    if (!prize) return 0;
    const i = WHEEL_ITEMS.findIndex((p) => p.key === prize.key);
    return i >= 0 ? i : 0;
  }, [prize]);

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setPhase("idle");
      setOffset(0);
      spinLockRef.current = false;
    }
  }, [open]);

  // Quando o prêmio chega, calcula o offset final e roda
  useEffect(() => {
    if (phase === "spinning" && prize) {
      const loops = 6; // dá 6 voltas
      const finalOffset = loops * WHEEL_ITEMS.length * itemH + winnerIndex * itemH;
      setOffset(finalOffset);
      const t = window.setTimeout(() => {
        setPhase("revealed");
        if (prize.tier !== "troll") fireConfetti();
      }, 3600);
      return () => window.clearTimeout(t);
    }
  }, [phase, prize, winnerIndex]);

  const handleSpin = async () => {
    if (spinLockRef.current) return;
    spinLockRef.current = true;
    setPhase("spinning");
    try {
      await onSpin();
    } catch {
      spinLockRef.current = false;
      setPhase("idle");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop glass */}
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-2xl"
            onClick={phase !== "spinning" ? onClose : undefined}
          />

          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-xl dark:bg-white/5"
            style={{
              backgroundImage:
                "linear-gradient(135deg, color-mix(in oklab, var(--primary) 12%, transparent), transparent 60%)",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={phase === "spinning"}
              className="absolute right-3 top-3 grid size-8 place-items-center rounded-full border border-white/15 bg-white/5 text-muted-foreground transition hover:bg-white/10 disabled:opacity-30"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </button>

            <div className="mb-4 text-center">
              <div className="mx-auto mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                <Sparkles className="size-3" /> Recompensa Semanal
              </div>
              <h2 className="font-display text-2xl font-bold">Roleta da Semana</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {eligible
                  ? "Você fechou a semana passada — hora de girar!"
                  : "Sua semana passada tem uma nota amarga…"}
              </p>
              <div className="mt-1.5">
                <RouletteHowItWorks />
              </div>
            </div>


            {/* Roleta vertical */}
            <div
              className={`relative mx-auto h-[216px] w-full max-w-[280px] overflow-hidden rounded-2xl border border-white/15 bg-black/30 ${
                !eligible ? "grayscale" : ""
              }`}
            >
              {/* fades top/bottom */}
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-black/60 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-gradient-to-t from-black/60 to-transparent" />
              {/* seletor central */}
              <div className="pointer-events-none absolute inset-x-3 top-1/2 z-20 -translate-y-1/2 h-[72px] rounded-xl border-2 border-primary/70 shadow-[0_0_24px_-4px_hsl(var(--primary)/0.6)]" />

              <div
                className="absolute inset-x-0 top-[72px]"
                style={{
                  transform: `translateY(-${offset}px)`,
                  transition:
                    phase === "spinning"
                      ? "transform 3.6s cubic-bezier(0.15, 0.9, 0.2, 1)"
                      : "none",
                }}
              >
                {Array.from({ length: 8 }).flatMap((_, loop) =>
                  WHEEL_ITEMS.map((p, i) => (
                    <div
                      key={`${loop}-${i}`}
                      className="flex h-[72px] items-center gap-3 px-4"
                    >
                      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-2xl">
                        {p.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-sm font-bold text-white">
                          {p.label}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-white/60">
                          {p.tier === "points"
                            ? "Boost"
                            : p.tier === "coin"
                              ? "Item"
                              : "Zoeira"}
                        </p>
                      </div>
                    </div>
                  )),
                )}
              </div>
            </div>

            {/* Estados abaixo da roleta */}
            <div className="mt-5 min-h-[96px] text-center">
              {!eligible && (
                <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4 text-sm">
                  <Frown className="mx-auto mb-1 size-5 text-orange-400" />
                  <p className="font-display font-bold">
                    Putz, você furou a semana passada.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sem roleta aqui hoje — {countedDays}/{requiredDays} check-ins.
                    Foco essa semana! 💪
                  </p>
                </div>
              )}

              {eligible && phase === "idle" && (
                <button
                  type="button"
                  onClick={handleSpin}
                  className="w-full rounded-full bg-gradient-to-r from-primary to-primary/80 px-6 py-3 font-display text-base font-bold text-primary-foreground shadow-flame transition hover:opacity-95"
                >
                  🎰 Girar a Roleta
                </button>
              )}

              {eligible && phase === "spinning" && (
                <p className="animate-pulse text-sm text-muted-foreground">
                  Girando…
                </p>
              )}

              {eligible && phase === "revealed" && prize && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-center gap-2 font-display text-lg font-bold">
                    {prize.tier === "troll" ? (
                      <Sparkles className="size-4 text-muted-foreground" />
                    ) : (
                      <Trophy className="size-4 text-primary" />
                    )}
                    <span>
                      {prize.tier === "troll" ? "Quase!" : "Você ganhou!"}
                    </span>
                  </div>
                  <p className="text-sm">
                    <span className="mr-1 text-2xl">{prize.emoji ?? "🎁"}</span>
                    <span className="font-semibold">{prize.label}</span>
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full rounded-full bg-primary px-6 py-3 font-display text-base font-bold text-primary-foreground shadow-flame transition hover:opacity-95"
                  >
                    Coletar
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
