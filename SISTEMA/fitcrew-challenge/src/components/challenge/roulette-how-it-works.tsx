import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, HelpCircle, Trophy, Coins, Zap, Frown } from "lucide-react";
import { PRIZES } from "@/lib/roulette.functions";

export function RouletteHowItWorks({ trigger }: { trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);

  const coins = PRIZES.filter((p) => p.tier === "coin");
  const points = PRIZES.filter((p) => p.tier === "points");
  const trolls = PRIZES.filter((p) => p.tier === "troll");

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)} className="inline-block cursor-pointer">
          {trigger}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <HelpCircle className="size-3.5" /> Como funciona
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[110] grid place-items-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-background/70 backdrop-blur-2xl"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.92, y: 12, opacity: 0 }}
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
                onClick={() => setOpen(false)}
                className="absolute right-3 top-3 grid size-8 place-items-center rounded-full border border-white/15 bg-white/5 text-muted-foreground hover:bg-white/10"
                aria-label="Fechar"
              >
                <X className="size-4" />
              </button>

              <div className="mb-4">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                  <HelpCircle className="size-3" /> Como funciona
                </div>
                <h2 className="font-display text-2xl font-bold">Roleta da Semana</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Recompensa exclusiva para quem cumpre a semana 100% no desafio.
                </p>
              </div>

              <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1 text-sm">
                <Section title="Quando aparece" icon="⏰">
                  <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                    <li>Toda <b className="text-foreground">segunda-feira</b>, no primeiro acesso à página do desafio.</li>
                    <li>Uma roleta <b className="text-foreground">por desafio</b> — se você participa de vários, cada um gira em separado.</li>
                    <li>Se você atualizar a página depois de girar, o resultado é o mesmo (nada de farmar 😉).</li>
                  </ul>
                </Section>

                <Section title="Como ganhar o giro" icon="✅">
                  <p className="text-muted-foreground">
                    Precisa ter batido a meta de dias da <b className="text-foreground">semana anterior</b> naquele
                    desafio (segunda a domingo). Faltou 1 dia? A roleta aparece <b className="text-foreground">cinza</b> com o
                    recado "sem prêmio hoje" — foco na próxima semana!
                  </p>
                </Section>

                <Section title="Prêmios possíveis" icon="🎁">
                  <div className="space-y-3">
                    <PrizeGroup
                      color="from-primary/20 to-primary/5 border-primary/30"
                      label="Boost no Ranking"
                      Icon={Zap}
                      items={points.map((p) => `${p.emoji} ${p.label}`)}
                      help="Somam direto no total de pontos do desafio."
                    />
                    <PrizeGroup
                      color="from-yellow-500/15 to-yellow-500/5 border-yellow-500/30"
                      label="Itens Virtuais"
                      Icon={Coins}
                      items={coins.map((p) => `${p.emoji} ${p.label}`)}
                      help="Borda dourada por 7 dias no seu avatar, emoji exclusivo desbloqueado no perfil e Ticket do Perdão para anular 1 falta futura."
                    />
                    <PrizeGroup
                      color="from-muted to-transparent border-border"
                      label="Zoeira (Troll)"
                      Icon={Frown}
                      items={trolls.map((p) => `${p.emoji} ${p.label}`)}
                      help="Não dá pontos — mas rende meme no grupo 😅"
                    />
                  </div>
                </Section>

                <Section title="Como o prêmio cai" icon={<Trophy className="size-4 text-primary" />}>
                  <p className="text-muted-foreground">
                    O sorteio é <b className="text-foreground">no servidor</b>, com pesos balanceados. O prêmio é
                    creditado <b className="text-foreground">na hora</b>: pontos vão pro ranking, itens ficam no
                    seu perfil, tickets ficam disponíveis no desafio.
                  </p>
                </Section>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-5 w-full rounded-full bg-primary px-6 py-3 font-display text-base font-bold text-primary-foreground shadow-flame transition hover:opacity-95"
              >
                Entendi
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 font-display text-sm font-bold">
        <span className="inline-flex size-5 items-center justify-center">{icon}</span>
        {title}
      </p>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function PrizeGroup({
  label,
  Icon,
  items,
  help,
  color,
}: {
  label: string;
  Icon: typeof Coins;
  items: string[];
  help: string;
  color: string;
}) {
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-3 ${color}`}>
      <div className="mb-1 flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wider">
        <Icon className="size-3.5" /> {label}
      </div>
      <ul className="space-y-0.5 text-sm">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{help}</p>
    </div>
  );
}
