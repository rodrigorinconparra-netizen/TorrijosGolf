import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  unit,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        {Icon ? (
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/10 text-accent">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight text-ink">{value}</span>
        {unit ? <span className="text-sm text-faint">{unit}</span> : null}
      </div>
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
