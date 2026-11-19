import { Heart, Percent, ShieldCheck, UserCheck, UserMinus, UserPlus, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { Stats } from "../core/types";
import { Card, cx } from "./ui";

function Stat({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: string; hint?: string; tone: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{label}</span>
        <span className={tone}>{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-white">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-zinc-500">{hint}</div>}
    </Card>
  );
}

const n = (v: number) => v.toLocaleString("es-ES");

export function StatsGrid({ s }: { s: Stats }) {
  const keep = Math.round(s.keepPercent * 10) / 10;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat icon={<Users size={16} />} tone="text-zinc-400" label="Cuentas seguidas" value={n(s.totalFollowing)} hint={`${n(s.totalFollowers)} seguidores`} />
        <Stat icon={<UserCheck size={16} />} tone="text-emerald-400" label="Amigos" value={n(s.friends)} hint={`${n(s.mutualFriends)} mutuos + ${n(s.whitelistedKept)} lista blanca`} />
        <Stat icon={<UserMinus size={16} />} tone="text-amber-400" label="No mutuas" value={n(s.nonMutual)} hint="Candidatas a revisar" />
        <Stat icon={<UserPlus size={16} />} tone="text-sky-400" label="Solo seguidores" value={n(s.followersOnly)} hint="Te siguen, no las sigues" />
        <Stat icon={<ShieldCheck size={16} />} tone="text-violet-400" label="Protegidas" value={n(s.whitelistedKept)} hint="Lista blanca activa" />
        <Stat icon={<Percent size={16} />} tone="text-accent" label="Se conservarán" value={`${keep.toLocaleString("es-ES")} %`} hint={`${n(s.friends)} de ${n(s.totalFollowing)}`} />
      </div>
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
          <span className="flex items-center gap-1.5"><Heart size={13} className="text-accent" /> Resultado si limpias todas las no mutuas</span>
          <span className="tabular-nums">{n(s.friends)} se quedan · {n(s.nonMutual)} se revisan</span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-ink-700" role="img" aria-label={`Se conservan ${keep} %`}>
          <div className={cx("bg-emerald-500 transition-all")} style={{ width: `${s.totalFollowing ? (s.mutualFriends / s.totalFollowing) * 100 : 0}%` }} title="Amigos mutuos" />
          <div className="bg-violet-500 transition-all" style={{ width: `${s.totalFollowing ? (s.whitelistedKept / s.totalFollowing) * 100 : 0}%` }} title="Lista blanca" />
          <div className="bg-amber-500/80 transition-all" style={{ width: `${s.totalFollowing ? (s.nonMutual / s.totalFollowing) * 100 : 0}%` }} title="No mutuas" />
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-500">
          <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />Mutuos</span>
          <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-violet-500" />Lista blanca</span>
          <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-500/80" />No mutuas</span>
        </div>
      </Card>
    </div>
  );
}
