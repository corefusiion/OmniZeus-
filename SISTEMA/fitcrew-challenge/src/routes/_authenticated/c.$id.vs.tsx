import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Flame, Swords, Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getHeadToHead, listChallengeMembers } from "@/lib/vs.functions";

export const Route = createFileRoute("/_authenticated/c/$id/vs")({
  component: VsPage,
});

function VsPage() {
  const { id } = Route.useParams();
  const membersFn = useServerFn(listChallengeMembers);
  const h2hFn = useServerFn(getHeadToHead);

  const membersQ = useQuery({
    queryKey: ["challenge-members", id],
    queryFn: () => membersFn({ data: { challengeId: id } }),
  });

  const [userA, setUserA] = useState<string | null>(null);
  const [userB, setUserB] = useState<string | null>(null);

  // pré-seleciona os dois primeiros
  useEffect(() => {
    const list = membersQ.data ?? [];
    if (!userA && list[0]) setUserA(list[0].user_id);
    if (!userB && list[1]) setUserB(list[1].user_id);
  }, [membersQ.data, userA, userB]);

  const h2hQ = useQuery({
    queryKey: ["h2h", id, userA, userB],
    enabled: !!userA && !!userB && userA !== userB,
    queryFn: () => h2hFn({ data: { challengeId: id, userA: userA!, userB: userB! } }),
  });

  const chartData = useMemo(() => {
    if (!h2hQ.data) return [];
    const a = h2hQ.data.a.cumulative;
    const b = h2hQ.data.b.cumulative;
    const dates = Array.from(new Set([...a.map((x) => x.date), ...b.map((x) => x.date)])).sort();
    const aMap = new Map(a.map((x) => [x.date, x.points]));
    const bMap = new Map(b.map((x) => [x.date, x.points]));
    let lastA = 0;
    let lastB = 0;
    return dates.map((d) => {
      lastA = aMap.get(d) ?? lastA;
      lastB = bMap.get(d) ?? lastB;
      return {
        date: d,
        label: new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        a: lastA,
        b: lastB,
      };
    });
  }, [h2hQ.data]);

  const members = membersQ.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">
          <Swords className="mr-2 inline size-6 text-primary" />
          Head-to-head
        </h1>
        <p className="text-sm text-muted-foreground">Compare dois membros lado a lado.</p>
      </div>

      {/* Seletores */}
      <div className="grid grid-cols-2 gap-3">
        <MemberSelect label="Membro A" value={userA} onChange={setUserA} members={members} exclude={userB} />
        <MemberSelect label="Membro B" value={userB} onChange={setUserB} members={members} exclude={userA} />
      </div>

      {h2hQ.isLoading && <p className="text-sm text-muted-foreground">Carregando comparação…</p>}
      {userA && userB && userA === userB && (
        <p className="text-sm text-muted-foreground">Escolha membros diferentes.</p>
      )}

      {h2hQ.data && (
        <>
          {/* Cabeçalho de avatares */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-3xl border border-border bg-card p-4 shadow-soft">
            <SideHeader side={h2hQ.data.a} align="left" isLeader={h2hQ.data.a.total_points > h2hQ.data.b.total_points} />
            <div className="grid place-items-center text-xl font-bold text-muted-foreground">VS</div>
            <SideHeader side={h2hQ.data.b} align="right" isLeader={h2hQ.data.b.total_points > h2hQ.data.a.total_points} />
          </div>

          {/* Tabela comparativa */}
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
            <StatRow label="Pontos totais" a={h2hQ.data.a.total_points} b={h2hQ.data.b.total_points} highlight />
            <StatRow label="Check-ins válidos" a={h2hQ.data.a.counted_days} b={h2hQ.data.b.counted_days} />
            <StatRow label="Streak atual" a={h2hQ.data.a.current_streak} b={h2hQ.data.b.current_streak} suffix="d" />
            <StatRow label="Maior streak" a={h2hQ.data.a.longest_streak} b={h2hQ.data.b.longest_streak} suffix="d" />
            <StatRow label="Dias esta semana" a={h2hQ.data.a.days_this_week} b={h2hQ.data.b.days_this_week} />
            <StatRow label="Minutos totais" a={h2hQ.data.a.total_minutes} b={h2hQ.data.b.total_minutes} last />
          </div>

          {/* Gráfico de evolução */}
          <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <h2 className="mb-3 font-display text-lg font-bold">Evolução de pontos</h2>
            {chartData.length < 2 ? (
              <p className="rounded-2xl bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
                Ainda sem dados suficientes para comparar.
              </p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="a"
                      name={h2hQ.data.a.display_name}
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={{ r: 2.5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="b"
                      name={h2hQ.data.b.display_name}
                      stroke="hsl(var(--accent))"
                      strokeWidth={2.5}
                      dot={{ r: 2.5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MemberSelect({
  label,
  value,
  onChange,
  members,
  exclude,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  members: { user_id: string; display_name: string; username: string | null }[];
  exclude: string | null;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</label>
      <Select value={value ?? undefined} onValueChange={onChange}>
        <SelectTrigger className="rounded-2xl">
          <SelectValue placeholder="Escolher…" />
        </SelectTrigger>
        <SelectContent>
          {members
            .filter((m) => m.user_id !== exclude)
            .map((m) => (
              <SelectItem key={m.user_id} value={m.user_id}>
                {m.display_name}
                {m.username ? ` · @${m.username}` : ""}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SideHeader({
  side,
  align,
  isLeader,
}: {
  side: {
    display_name: string;
    username: string | null;
    avatar_url: string | null;
    total_points: number;
  };
  align: "left" | "right";
  isLeader: boolean;
}) {
  const initials = side.display_name.slice(0, 2).toUpperCase();
  return (
    <div className={`flex items-center gap-3 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <Avatar className="size-12">
        <AvatarImage src={side.avatar_url ?? undefined} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-display font-bold leading-tight">
          {isLeader && <Trophy className="mr-1 inline size-4 text-amber-500" />}
          {side.display_name}
        </p>
        {side.username && <p className="truncate text-xs text-muted-foreground">@{side.username}</p>}
        <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold tabular-nums text-primary">
          <Flame className="size-3" /> {side.total_points} pts
        </p>
      </div>
    </div>
  );
}

function StatRow({
  label,
  a,
  b,
  suffix,
  highlight,
  last,
}: {
  label: string;
  a: number;
  b: number;
  suffix?: string;
  highlight?: boolean;
  last?: boolean;
}) {
  const aWin = a > b;
  const bWin = b > a;
  return (
    <div className={`grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 ${last ? "" : "border-b border-border"} ${highlight ? "bg-secondary/30" : ""}`}>
      <div
        className={`text-right tabular-nums ${aWin ? "font-bold text-primary" : "text-foreground"} ${highlight ? "text-lg" : "text-sm"}`}
      >
        {a}
        {suffix}
      </div>
      <div className="text-center text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={`text-left tabular-nums ${bWin ? "font-bold text-primary" : "text-foreground"} ${highlight ? "text-lg" : "text-sm"}`}
      >
        {b}
        {suffix}
      </div>
    </div>
  );
}
