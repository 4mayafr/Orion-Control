import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  ClipboardList,
  Database,
  Gauge,
  Radio,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Badge, BrandMark, buttonStyles } from '@/components/ui/primitives';

const FEATURES = [
  {
    icon: Gauge,
    title: 'Operational overview',
    body: 'Players online, active matches, server health and worker state in one control surface.',
  },
  {
    icon: ClipboardList,
    title: 'Background task engine',
    body: 'Long-running requests are queued, claimed by your worker and stored with raw and parsed results.',
  },
  {
    icon: Bot,
    title: 'Discord worker',
    body: 'A Node.js worker relays requests through a private channel and reports its own health.',
  },
  {
    icon: BarChart3,
    title: 'Historical analytics',
    body: 'Player counts, match activity and server health tracked over time with clear data provenance.',
  },
  {
    icon: Users,
    title: 'Operators & permissions',
    body: 'Role-based access with per-operator overrides, enforced on the API rather than by hidden buttons.',
  },
  {
    icon: ShieldCheck,
    title: 'Audit trail',
    body: 'Sign-ins, task changes, operator edits and key rotations are recorded for review.',
  },
];

const PREVIEW_STATS = [
  { label: 'Players online', value: '148', accent: 'text-cyber-300' },
  { label: 'Active matches', value: '12', accent: 'text-brand-200' },
  { label: 'Active servers', value: '3 / 4', accent: 'text-slate-100' },
  { label: 'Server health', value: '92%', accent: 'text-signal-success' },
];

const PREVIEW_BARS = [46, 58, 51, 64, 72, 61, 78, 69, 82, 74, 88, 79];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 grid-overlay opacity-40" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-brand-600/20 blur-[140px]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <BrandMark />
        <div className="flex items-center gap-2">
          <Link href="/login" className={buttonStyles('secondary', 'sm')}>
            Sign in
          </Link>
          <Link href="/login" className={buttonStyles('primary', 'sm', 'hidden sm:inline-flex')}>
            Open console <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8">
        <section className="grid items-center gap-10 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
          <div className="animate-fade-up">
            <Badge variant="cyan" dot>
              Independent community operations platform
            </Badge>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-slate-50 sm:text-5xl lg:text-[56px]">
              Mission control for your{' '}
              <span className="bg-gradient-to-r from-brand-300 via-brand-200 to-cyber-300 bg-clip-text text-transparent">
                game community
              </span>
              .
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-slate-400">
              ORION CONTROL is a web operations platform for game communities: server statistics,
              Discord-driven background tasks, operator permissions and a complete execution
              history. The website runs in the cloud; a small worker on your own machine does the
              integration work.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/login" className={buttonStyles('primary')}>
                Enter operations console <ArrowRight size={16} />
              </Link>
              <a href="#architecture" className={buttonStyles('secondary')}>
                How it works
              </a>
            </div>

            <dl className="mt-9 grid max-w-lg grid-cols-3 gap-4 border-t border-edge/60 pt-5">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Website</dt>
                <dd className="mt-1 text-sm text-slate-300">Next.js on Vercel</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Worker</dt>
                <dd className="mt-1 text-sm text-slate-300">Node.js + Discord.js</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Storage</dt>
                <dd className="mt-1 text-sm text-slate-300">Hosted PostgreSQL</dd>
              </div>
            </dl>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-brand-500/15 via-transparent to-cyber-500/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-edge bg-void-900/80 shadow-panel">
              <div className="flex items-center justify-between border-b border-edge/70 px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-signal-danger/70" />
                  <span className="h-2 w-2 rounded-full bg-signal-warning/70" />
                  <span className="h-2 w-2 rounded-full bg-signal-success/70" />
                  <span className="ml-2 font-mono text-[10px] text-slate-500">orion.control / overview</span>
                </div>
                <span className="rounded-full border border-signal-warning/25 bg-signal-warning/[0.08] px-2 py-0.5 text-[9px] uppercase tracking-wider text-signal-warning">
                  Simulated preview
                </span>
              </div>

              <div className="space-y-4 p-4">
                <div className="grid grid-cols-2 gap-2.5">
                  {PREVIEW_STATS.map((stat) => (
                    <div key={stat.label} className="rounded-lg border border-edge/70 bg-void-850/70 px-3 py-2.5">
                      <p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">{stat.label}</p>
                      <p className={`mt-1.5 font-mono text-xl font-semibold ${stat.accent}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-edge/70 bg-void-850/50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      Player activity · 12h
                    </p>
                    <Activity size={12} className="text-cyber-400" />
                  </div>
                  <div className="mt-3 flex h-20 items-end gap-1.5">
                    {PREVIEW_BARS.map((height, index) => (
                      <div
                        key={index}
                        className="flex-1 rounded-sm bg-gradient-to-t from-brand-600/40 to-cyber-400/70"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { label: 'Worker heartbeat', value: 'Healthy · 12s ago', tone: 'text-signal-success' },
                    { label: 'Last retrieval', value: 'Simulated snapshot', tone: 'text-signal-warning' },
                    { label: 'Queued tasks', value: '1 queued · 0 running', tone: 'text-slate-300' },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between rounded-lg border border-edge/60 bg-void-850/40 px-3 py-2 text-[11px]"
                    >
                      <span className="text-slate-500">{row.label}</span>
                      <span className={row.tone}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-[10px] uppercase tracking-[0.18em] text-slate-600">
              Interface preview · no live Orion Drift data
            </p>
          </div>
        </section>

        <section className="border-t border-edge/60 py-12">
          <div className="mb-8 max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-300/80">
              Built for operations
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
              Everything you need to run the community, in one console.
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="panel p-5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-400/20 bg-brand-500/10 text-brand-200">
                    <Icon size={17} strokeWidth={1.8} />
                  </span>
                  <h3 className="mt-4 text-sm font-medium text-slate-100">{feature.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{feature.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="architecture" className="border-t border-edge/60 py-12">
          <div className="mb-8 max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyber-300/80">
              Two independent components
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
              The cloud stays online even when your Chromebook does not.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              The website and the worker are separate programs with a one-way trust model: the worker
              polls outbound over HTTPS, claims work, and submits results. Nothing on your home network
              needs a public port.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <article className="panel p-6">
              <div className="flex items-center justify-between">
                <Badge variant="brand">Component A</Badge>
                <Database size={16} className="text-slate-600" />
              </div>
              <h3 className="mt-4 text-lg font-medium text-slate-100">ORION CONTROL Web</h3>
              <p className="mt-1 text-xs uppercase tracking-wider text-slate-600">Vercel · Next.js · PostgreSQL</p>
              <ul className="mt-4 space-y-2 text-[13px] text-slate-400">
                <li>• Authentication, operators and permissions</li>
                <li>• Dashboards, statistics and history</li>
                <li>• Task queue, results and audit logs</li>
                <li>• Remains available when the worker is offline</li>
              </ul>
            </article>

            <div className="flex flex-col items-center gap-2 px-2 text-center">
              <Radio size={18} className="text-cyber-400" />
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-600">HTTPS · outbound only</p>
              <div className="hidden h-px w-full min-w-[60px] bg-gradient-to-r from-brand-500/40 via-cyber-400/60 to-brand-500/40 lg:block" />
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-600">claim · execute · report</p>
            </div>

            <article className="panel p-6">
              <div className="flex items-center justify-between">
                <Badge variant="cyan">Component B</Badge>
                <Bot size={16} className="text-slate-600" />
              </div>
              <h3 className="mt-4 text-lg font-medium text-slate-100">ORION CONTROL Worker</h3>
              <p className="mt-1 text-xs uppercase tracking-wider text-slate-600">Chromebook · Node.js · Discord.js</p>
              <ul className="mt-4 space-y-2 text-[13px] text-slate-400">
                <li>• Polls the website for queued tasks</li>
                <li>• Talks to Discord through a private channel</li>
                <li>• Parses responses and submits results</li>
                <li>• Sends heartbeats so the site knows its state</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="border-t border-edge/60 py-12">
          <div className="panel bg-gradient-to-br from-brand-600/10 via-void-900/60 to-cyber-500/[0.06] p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
              <div>
                <Badge variant="warning">Read this first</Badge>
                <h2 className="mt-3 text-xl font-semibold text-slate-100">
                  Simulated data is labelled. Always.
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
                  ORION CONTROL is an independent community project. It does not access Orion Drift&apos;s
                  private infrastructure or internal APIs. Until you connect an authorised integration,
                  statistics come from a mock generator and every screen marks them{' '}
                  <span className="text-signal-warning">Simulated</span>. Retrieved data is marked{' '}
                  <span className="text-signal-success">Retrieved</span> and keeps its raw response for
                  inspection.
                </p>
              </div>
              <div className="space-y-2">
                <div className="rounded-lg border border-signal-warning/25 bg-signal-warning/[0.06] px-4 py-3">
                  <p className="text-[11px] font-medium text-signal-warning">Simulated</p>
                  <p className="mt-1 text-xs text-slate-500">Placeholder generated by the mock adapter.</p>
                </div>
                <div className="rounded-lg border border-signal-success/25 bg-signal-success/[0.06] px-4 py-3">
                  <p className="text-[11px] font-medium text-signal-success">Retrieved</p>
                  <p className="mt-1 text-xs text-slate-500">Parsed from an authorised Discord response.</p>
                </div>
                <div className="rounded-lg border border-edge-bright/60 bg-void-850/60 px-4 py-3">
                  <p className="text-[11px] font-medium text-slate-300">Unavailable</p>
                  <p className="mt-1 text-xs text-slate-500">Nothing collected yet — never invented.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-16 pt-4">
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-edge bg-void-900/60 p-6 sm:flex-row sm:items-center sm:p-8">
            <div>
              <h2 className="text-lg font-medium text-slate-100">Ready to take command?</h2>
              <p className="mt-1 text-sm text-slate-500">
                Sign in with an operator account, or create the first administrator if this is a fresh install.
              </p>
            </div>
            <Link href="/login" className={buttonStyles('primary')}>
              Open operations console <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-edge/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-3 px-5 py-6 text-[11px] text-slate-600 sm:flex-row sm:items-center sm:px-8">
          <BrandMark size="sm" />
          <p>
            Independent community project · No affiliation with Orion Drift · Simulated data is always labelled
          </p>
        </div>
      </footer>
    </div>
  );
}
