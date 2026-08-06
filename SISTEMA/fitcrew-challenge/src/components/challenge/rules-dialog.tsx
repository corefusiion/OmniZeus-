import { Flame, Trophy, Timer, Camera, Zap, ShieldCheck, HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export type ChallengeRules = {
  name: string;
  description?: string | null;
  max_days_per_week: number;
  streak_bonus_points: number;
  checkin_cooldown_min: number;
  duration_bonus_step_min: number;
  duration_bonus_cap_pct: number;
  tiebreak_duration_cap_min: number;
};

export function RulesDialog({
  challenge,
  trigger,
}: {
  challenge: ChallengeRules;
  trigger?: React.ReactNode;
}) {
  const base = 10; // exemplo didático
  const capBonus = Math.floor((base * challenge.duration_bonus_cap_pct) / 100);
  const capMinutes = capBonus * challenge.duration_bonus_step_min;

  return (
    <Dialog>
      <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger ?? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 rounded-full px-3 text-xs"
          >
            <Flame className="size-3" /> Regras
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Flame className="size-5 text-primary" />
            Regras da temporada
          </DialogTitle>
          <DialogDescription>
            Como funciona a pontuação em <b>{challenge.name}</b>.
          </DialogDescription>
        </DialogHeader>

        {challenge.description && (
          <p className="rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">
            {challenge.description}
          </p>
        )}

        <div className="grid gap-3 text-sm">
          <RuleItem
            icon={<Trophy className="size-4 text-primary" />}
            title="Dias válidos por semana"
            desc={`Contam até ${challenge.max_days_per_week} dias por semana. Check-ins acima do limite não pontuam.`}
            example={
              <>
                <p>Se o limite é <b>{challenge.max_days_per_week} dias/semana</b> e você treina todo dia, os primeiros {challenge.max_days_per_week} pontuam normalmente. Os dias extras da mesma semana entram como <b>“sobre limite”</b> — aparecem no histórico, mas valem <b>0 ponto</b>.</p>
              </>
            }
          />
          <RuleItem
            icon={<Timer className="size-4 text-primary" />}
            title="Duração mínima"
            desc="Cada tipo de exercício tem duração mínima (geralmente ≥30min). Abaixo disso o check-in é rejeitado."
            example={
              <p>
                Ex.: musculação com mínimo de <b>30min</b>. Se você registrar <b>25min</b>, o check-in é <b>rejeitado</b> e nenhum ponto é dado. Com <b>30min ou mais</b>, entra na conta normalmente.
              </p>
            }
          />
          <RuleItem
            icon={<Zap className="size-4 text-primary" />}
            title="Pontuação por duração"
            desc={`Base do exercício + 1 ponto extra a cada ${challenge.duration_bonus_step_min}min adicionais, com teto de +${challenge.duration_bonus_cap_pct}% da base.`}
            example={
              <div className="space-y-2">
                <p>Exemplo com <b>base = {base} pts</b>, passo de <b>{challenge.duration_bonus_step_min}min</b> e teto de <b>+{challenge.duration_bonus_cap_pct}%</b>:</p>
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr><th className="text-left font-medium">Duração</th><th className="text-left font-medium">Cálculo</th><th className="text-right font-medium">Pontos</th></tr>
                  </thead>
                  <tbody className="[&>tr]:border-t [&>tr]:border-border/60">
                    <tr><td className="py-1">30min</td><td>base</td><td className="text-right">{base}</td></tr>
                    <tr><td className="py-1">45min</td><td>{base} + 1</td><td className="text-right">{base + 1}</td></tr>
                    <tr><td className="py-1">60min</td><td>{base} + 2</td><td className="text-right">{base + 2}</td></tr>
                    <tr><td className="py-1">≥{30 + capMinutes}min</td><td>{base} + {capBonus} (teto)</td><td className="text-right">{base + capBonus}</td></tr>
                  </tbody>
                </table>
                <p className="text-muted-foreground">Depois do teto o bônus para de crescer — treinos muito longos não farmam pontos.</p>
              </div>
            }
          />
          <RuleItem
            icon={<Flame className="size-4 text-primary" />}
            title="Bônus de streak"
            desc={`+${challenge.streak_bonus_points} pts quando você emenda 3 dias ou mais consecutivos.`}
            example={
              <p>
                Treinou seg/ter/qua sem furar? A partir do <b>3º dia consecutivo</b> cada check-in ganha <b>+{challenge.streak_bonus_points} pts</b> extras. Perdeu um dia? A sequência zera e o bônus só volta quando emendar 3 dias de novo.
              </p>
            }
          />
          <RuleItem
            icon={<ShieldCheck className="size-4 text-primary" />}
            title="Anti-abuso"
            desc={`Cooldown de ${challenge.checkin_cooldown_min}min entre check-ins manuais. 1 pontuação por dia. No desempate a duração conta até ${challenge.tiebreak_duration_cap_min}min por check-in.`}
            example={
              <ul className="list-disc space-y-1 pl-4">
                <li><b>Cooldown</b>: fez um check-in? Precisa esperar <b>{challenge.checkin_cooldown_min}min</b> para fazer outro manual.</li>
                <li><b>1 por dia pontua</b>: check-ins repetidos no mesmo dia entram no histórico, mas só o primeiro dá pontos.</li>
                <li><b>Desempate</b>: no ranking, quem tem mais minutos treinados leva vantagem — mas cada check-in conta até <b>{challenge.tiebreak_duration_cap_min}min</b>, para não inflar com treinos de 4h.</li>
              </ul>
            }
          />
          <RuleItem
            icon={<Camera className="size-4 text-primary" />}
            title="Foto do dia"
            desc="Foto obrigatória em check-in manual. Fotos de galeria ou sem EXIF são sinalizadas para revisão."
            example={
              <ul className="list-disc space-y-1 pl-4">
                <li><b>Câmera</b> (recomendado): abre a câmera do celular e captura na hora.</li>
                <li><b>Galeria</b>: permitido, mas o check-in fica <b>marcado para revisão</b> — admins podem invalidar se a foto for antiga ou fora do contexto.</li>
                <li>Foto <b>sem data/hora (EXIF)</b> ou tirada há mais de <b>24h</b>: também vai para revisão automaticamente.</li>
              </ul>
            }
          />
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          Empates no ranking são resolvidos por: dias treinados → minutos (limitados) → quem pontuou primeiro.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function RuleItem({
  icon,
  title,
  desc,
  example,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  example?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-card p-3">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
        {example && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <HelpCircle className="size-3" /> Exemplo
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              className="w-80 max-w-[calc(100vw-2rem)] text-xs leading-relaxed"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-2 font-semibold text-foreground">{title} — exemplo</p>
              <div className="space-y-2 text-muted-foreground">{example}</div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
