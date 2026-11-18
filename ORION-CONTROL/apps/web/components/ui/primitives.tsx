import type { ButtonHTMLAttributes, ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Orbit,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/cn';

/* ── Brand ───────────────────────────────────────────────────────────────── */

export function BrandMark({
  size = 'md',
  showTagline = false,
}: {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}) {
  const dimensions = {
    sm: { box: 'h-8 w-8', icon: 16, title: 'text-sm', subtitle: 'text-[9px]' },
    md: { box: 'h-10 w-10', icon: 20, title: 'text-base', subtitle: 'text-[10px]' },
    lg: { box: 'h-12 w-12', icon: 24, title: 'text-lg', subtitle: 'text-[11px]' },
  }[size];

  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          'relative flex shrink-0 items-center justify-center rounded-xl border border-brand-400/40 bg-gradient-to-br from-brand-600/30 via-void-800 to-cyber-500/20 text-brand-200 shadow-glow-brand',
          dimensions.box,
        )}
      >
        <Orbit size={dimensions.icon} strokeWidth={1.8} />
        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-cyber-400 shadow-[0_0_8px_2px_rgba(34,211,238,0.6)]" />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            'block font-semibold uppercase tracking-[0.2em] text-slate-100',
            dimensions.title,
          )}
        >
          Orion Control
        </span>
        {showTagline && (
          <span className={cn('mt-1 block uppercase tracking-[0.22em] text-slate-500', dimensions.subtitle)}>
            Operations Platform
          </span>
        )}
      </span>
    </div>
  );
}

/* ── Cards ───────────────────────────────────────────────────────────────── */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('panel', className)}>{children}</section>;
}

export function CardHeader({
  title,
  description,
  actions,
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="panel-header">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="mt-0.5 text-brand-300">{icon}</span>}
        <div className="min-w-0">
          <h2 className="panel-title">{title}</h2>
          {description && <div className="panel-subtitle">{description}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <div className={cn(padded && 'panel-body', className)}>{children}</div>;
}

/* ── Badges ──────────────────────────────────────────────────────────────── */

export type BadgeVariant =
  | 'neutral'
  | 'brand'
  | 'cyan'
  | 'success'
  | 'warning'
  | 'danger'
  | 'outline';

const BADGE_STYLES: Record<BadgeVariant, string> = {
  neutral: 'border-edge-bright/60 bg-void-800/80 text-slate-400',
  brand: 'border-brand-400/30 bg-brand-500/10 text-brand-200',
  cyan: 'border-cyber-400/30 bg-cyber-400/10 text-cyber-300',
  success: 'border-signal-success/30 bg-signal-success/10 text-signal-success',
  warning: 'border-signal-warning/30 bg-signal-warning/10 text-signal-warning',
  danger: 'border-signal-danger/30 bg-signal-danger/10 text-signal-danger',
  outline: 'border-edge-bright/80 bg-transparent text-slate-300',
};

const DOT_STYLES: Record<BadgeVariant, string> = {
  neutral: 'bg-slate-500',
  brand: 'bg-brand-400',
  cyan: 'bg-cyber-400',
  success: 'bg-signal-success',
  warning: 'bg-signal-warning',
  danger: 'bg-signal-danger',
  outline: 'bg-slate-400',
};

export function Badge({
  children,
  variant = 'neutral',
  className,
  dot = false,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
        BADGE_STYLES[variant],
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', DOT_STYLES[variant])} />}
      {children}
    </span>
  );
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export function buttonStyles(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn('btn', `btn-${variant}`, size === 'sm' && 'btn-xs', className);
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button type={type} className={buttonStyles(variant, size, className)} {...props} />;
}

/* ── Page header ─────────────────────────────────────────────────────────── */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-300/80">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-[27px]">{title}</h1>
        {description && (
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ── Stat card ───────────────────────────────────────────────────────────── */

const TONE_STYLES = {
  brand: 'border-brand-400/20 bg-brand-500/10 text-brand-200',
  cyan: 'border-cyber-400/20 bg-cyber-400/10 text-cyber-300',
  success: 'border-signal-success/20 bg-signal-success/10 text-signal-success',
  warning: 'border-signal-warning/20 bg-signal-warning/10 text-signal-warning',
  danger: 'border-signal-danger/20 bg-signal-danger/10 text-signal-danger',
  neutral: 'border-edge-bright/60 bg-void-800 text-slate-300',
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon,
  badge,
  tone = 'brand',
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  tone?: keyof typeof TONE_STYLES;
  className?: string;
}) {
  return (
    <div className={cn('panel animate-fade-up p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="mt-3 font-mono text-[28px] font-semibold leading-none text-slate-50">{value}</p>
          {hint && <p className="mt-2 text-xs leading-relaxed text-slate-500">{hint}</p>}
        </div>
        {icon && (
          <span className={cn('shrink-0 rounded-lg border p-2.5', TONE_STYLES[tone])}>{icon}</span>
        )}
      </div>
      {badge && <div className="mt-4">{badge}</div>}
    </div>
  );
}

/* ── Alerts ──────────────────────────────────────────────────────────────── */

const ALERT_STYLES = {
  info: {
    wrapper: 'border-cyber-400/25 bg-cyber-400/[0.06] text-cyber-100',
    icon: <Info size={16} className="text-cyber-300" />,
  },
  warning: {
    wrapper: 'border-signal-warning/25 bg-signal-warning/[0.06] text-signal-warning',
    icon: <AlertTriangle size={16} className="text-signal-warning" />,
  },
  danger: {
    wrapper: 'border-signal-danger/25 bg-signal-danger/[0.06] text-signal-danger',
    icon: <ShieldAlert size={16} className="text-signal-danger" />,
  },
  success: {
    wrapper: 'border-signal-success/25 bg-signal-success/[0.06] text-signal-success',
    icon: <CheckCircle2 size={16} className="text-signal-success" />,
  },
} as const;

export function Alert({
  variant = 'info',
  title,
  children,
  action,
  className,
}: {
  variant?: keyof typeof ALERT_STYLES;
  title?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const style = ALERT_STYLES[variant];
  return (
    <div className={cn('rounded-lg border px-4 py-3 text-sm', style.wrapper, className)}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0">{style.icon}</span>
        <div className="min-w-0 flex-1 space-y-1">
          {title && <p className="font-medium">{title}</p>}
          <div className="text-[13px] leading-relaxed text-slate-300/90">{children}</div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

/* ── Misc ────────────────────────────────────────────────────────────────── */

export function Progress({
  value,
  tone = 'brand',
  className,
}: {
  value: number;
  tone?: 'brand' | 'cyan' | 'success' | 'warning' | 'danger';
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const bar = {
    brand: 'bg-gradient-to-r from-brand-500 to-brand-300',
    cyan: 'bg-gradient-to-r from-cyber-500 to-cyber-300',
    success: 'bg-signal-success',
    warning: 'bg-signal-warning',
    danger: 'bg-signal-danger',
  }[tone];
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-void-700/80', className)}>
      <div className={cn('h-full rounded-full transition-all', bar)} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon && (
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-edge-bright/70 bg-void-800 text-slate-500">
          {icon}
        </span>
      )}
      <p className="text-sm font-medium text-slate-200">{title}</p>
      {description && <p className="mt-1.5 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function CodeBlock({ children, className }: { children: string; className?: string }) {
  return (
    <pre
      className={cn(
        'mono max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-edge bg-void-950/80 p-4 text-[11px] leading-relaxed text-slate-300',
        className,
      )}
    >
      {children}
    </pre>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 size={16} className={cn('animate-spin', className)} />;
}

export function MetaItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">{label}</p>
      <p className="mt-1 text-sm text-slate-300">{value}</p>
    </div>
  );
}
