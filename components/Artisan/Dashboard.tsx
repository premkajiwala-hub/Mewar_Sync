import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, BookOpen, Camera, Mic, Package, PackagePlus, Plus, TrendingUp, Wallet,
} from 'lucide-react';
import type { InventoryItem, LedgerEntry } from '../../types';
import { storage } from '../../services/storage';
import { errorMessage } from '../../services/api';
import { useApp } from '../layout/AppContext';
import { PageContainer } from '../layout/AppShell';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/Form';
import { Badge, Card, CardHeader, EmptyState, ErrorState, LoadingBlock, Money } from '../ui/Surface';
import { Emblem } from '../ui/Ornaments';
import {
  ENTRY_TYPE_LABELS, buildCashFlowSeries, entriesOnDate, isInflow, summarizeBusiness, summarizeCash, summarizeDues,
  type ChartRange,
} from '../../lib/ledger';
import { inventoryValuation, stockStatus } from '../../lib/inventory';
import { addDays, formatDateTime, localDateKey } from '../../lib/dates';
import { formatINR, formatINRCompact } from '../../lib/money';
import { cx } from '../../lib/cx';

import { VOICE_EVENT } from '../../lib/events';
import { VOICE_ENABLED } from '../../lib/features';

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export const ArtisanDashboard: React.FC = () => {
  const { user, dataVersion, navigate, openNewEntry } = useApp();
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [udhaar, setUdhaar] = useState<LedgerEntry[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [range, setRange] = useState<ChartRange>('WEEK');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  const today = localDateKey();

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const now = new Date();
      const yearStart = `${now.getFullYear()}-01-01`;
      const from = addDays(today, -7) < yearStart ? addDays(today, -7) : yearStart;
      const [l, u, i] = await Promise.all([storage.getLedgerRange(from, today), storage.getUdhaarEntries(), storage.getInventory()]);
      setLedger(l);
      setUdhaar(u);
      setInventory(i);
      setStatus('ready');
    } catch (err) {
      setError(errorMessage(err, 'Could not load your overview.'));
      setStatus('error');
    }
  }, [today]);

  useEffect(() => {
    void load();
  }, [load, dataVersion]);

  const todays = useMemo(() => entriesOnDate(ledger, today), [ledger, today]);
  const cashToday = useMemo(() => summarizeCash(todays), [todays]);
  const businessToday = useMemo(() => summarizeBusiness(todays), [todays]);
  const dues = useMemo(() => summarizeDues(udhaar), [udhaar]);
  const series = useMemo(() => buildCashFlowSeries(ledger, range), [ledger, range]);
  const lowStock = useMemo(() => inventory.filter(i => stockStatus(i.quantity) !== 'OK').sort((a, b) => a.quantity - b.quantity), [inventory]);
  const outOfStock = lowStock.filter(i => i.quantity <= 0).length;
  const recent = useMemo(() => [...ledger, ...udhaar].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 6), [ledger, udhaar]);
  const monthKey = today.slice(0, 7);
  const month = useMemo(() => summarizeBusiness(ledger.filter(e => e.created_at && localDateKey(e.created_at).startsWith(monthKey))), [ledger, monthKey]);
  const seriesTotals = useMemo(() => series.reduce((acc, p) => ({ inflow: acc.inflow + p.inflow, outflow: acc.outflow + p.outflow }), { inflow: 0, outflow: 0 }), [series]);

  const firstName = user.name.split(' ')[0];
  const now = new Date();
  const isNewUser = status === 'ready' && ledger.length === 0 && udhaar.length === 0 && inventory.length === 0;

  return (
    <PageContainer wide>
      {/* Greeting */}
      <section aria-labelledby="greeting" className="ms-glass relative mb-6 overflow-hidden rounded-[22px] px-5 py-6 sm:px-8 sm:py-7">
        <div aria-hidden className="ms-jaali absolute inset-y-0 right-0 w-1/2 opacity-60 [mask-image:linear-gradient(to_left,black,transparent)]" />
        <Emblem className="pointer-events-none absolute -right-6 -top-8 hidden size-48 text-gold/15 sm:block lg:right-10" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[13px] font-medium text-ink-muted">{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <h1 id="greeting" className="mt-1 text-[28px] font-semibold sm:text-[34px]">
              Khamma Ghani, {firstName}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={Plus} onClick={() => openNewEntry?.()}>New entry</Button>
            {VOICE_ENABLED && (
              <Button variant="secondary" icon={Mic} onClick={() => window.dispatchEvent(new CustomEvent(VOICE_EVENT))}>
                Speak an entry
              </Button>
            )}
            <Button variant="secondary" icon={PackagePlus} onClick={() => navigate('/inventory')}>Stock</Button>
            <Button variant="secondary" icon={Camera} onClick={() => navigate('/scan')}>List a piece</Button>
          </div>
        </div>
      </section>

      {status === 'loading' && <Card><LoadingBlock label="Loading your overview" rows={4} /></Card>}
      {status === 'error' && <Card><ErrorState message={error} onRetry={load} /></Card>}

      {isNewUser && (
        <Card className="mb-6">
          <EmptyState
            icon={BookOpen}
            title="Start your bahi-khata"
            description="Add your stock, then record your first sale."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button icon={PackagePlus} onClick={() => navigate('/inventory')}>Add stock</Button>
                <Button variant="secondary" icon={Plus} onClick={() => openNewEntry?.()}>Record an entry</Button>
              </div>
            }
          />
        </Card>
      )}

      {status === 'ready' && !isNewUser && (
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Today's galla */}
          <Card className="lg:col-span-7">
            <div className="flex flex-col gap-5 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[15px] font-semibold text-ink">Today’s galla</p>
                  <p className="text-[13px] text-ink-muted">Cash in hand</p>
                </div>
                <Badge tone={cashToday.net >= 0 ? 'success' : 'danger'} icon={TrendingUp}>{cashToday.net >= 0 ? 'Surplus' : 'Deficit'}</Badge>
              </div>
              <p className={cx('ms-num text-[44px] font-semibold leading-none tracking-[-0.03em] sm:text-[56px]', cashToday.net >= 0 ? 'text-ink' : 'text-danger')}>
                {cashToday.net < 0 && <span aria-hidden>−</span>}
                {formatINR(Math.abs(cashToday.net))}
                <span className="sr-only">{cashToday.net < 0 ? ' deficit' : ''}</span>
              </p>
              <div aria-hidden className="ms-hairline" />
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div><dt className="text-xs text-ink-muted">Money in</dt><dd className="mt-0.5 font-semibold"><Money value={cashToday.inflow} direction="in" /></dd></div>
                <div><dt className="text-xs text-ink-muted">Money out</dt><dd className="mt-0.5 font-semibold"><Money value={cashToday.outflow} direction="out" /></dd></div>
                <div><dt className="text-xs text-ink-muted">Sales</dt><dd className="ms-num mt-0.5 font-semibold">{formatINR(businessToday.sales)}</dd></div>
                <div><dt className="text-xs text-ink-muted">Entries</dt><dd className="ms-num mt-0.5 font-semibold">{todays.length}</dd></div>
              </dl>
              <div>
                <Button variant="secondary" size="sm" iconRight={ArrowRight} onClick={() => navigate('/ledger')}>Open today’s ledger</Button>
              </div>
            </div>
          </Card>

          {/* Udhaar */}
          <Card className="lg:col-span-5">
            <CardHeader title="Udhaar" icon={Wallet} action={<Button variant="ghost" size="sm" iconRight={ArrowRight} onClick={() => navigate('/udhaar')}>View</Button>} />
            <div className="grid grid-cols-2 divide-x divide-line-soft">
              <div className="p-5">
                <p className="flex items-center gap-1.5 text-sm text-ink-muted"><ArrowDownLeft aria-hidden className="size-4 text-success" /> To collect</p>
                <p className="ms-num mt-1 text-[28px] font-semibold tracking-[-0.02em] text-success">{formatINR(dues.receivable)}</p>
                <p className="mt-1 text-xs text-ink-muted">{dues.receivableCount} {dues.receivableCount === 1 ? 'entry' : 'entries'} owed to you</p>
              </div>
              <div className="p-5">
                <p className="flex items-center gap-1.5 text-sm text-ink-muted"><ArrowUpRight aria-hidden className="size-4 text-maroon" /> To pay</p>
                <p className="ms-num mt-1 text-[28px] font-semibold tracking-[-0.02em] text-maroon">{formatINR(dues.payable)}</p>
                <p className="mt-1 text-xs text-ink-muted">{dues.payableCount} {dues.payableCount === 1 ? 'entry' : 'entries'} you owe</p>
              </div>
            </div>
            {udhaar.length > 0 && (
              <div className="border-t border-line-soft px-5 py-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">Oldest open</p>
                <ul className="divide-y divide-line-soft">
                  {[...udhaar].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)).slice(0, 3).map(e => (
                    <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{e.customer_name || e.item}</span>
                        <span className="text-ink-muted"> · {formatDateTime(e.created_at).split(',')[0]}</span>
                      </span>
                      <Money value={e.amount} direction={isInflow(e.type) ? 'in' : 'out'} className="font-semibold" />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Cash-flow chart */}
          <Card className="lg:col-span-8">
            <CardHeader
              title="Cash flow"
              icon={TrendingUp}
              action={<SegmentedControl label="Chart period" size="sm" value={range} onChange={setRange} options={[{ value: 'WEEK', label: 'Week' }, { value: 'MONTH', label: 'Month' }, { value: 'YEAR', label: 'Year' }]} />}
            />
            <div className="p-4 sm:p-5">
              <p className="mb-3 text-sm text-ink-muted">
                This {range.toLowerCase()}: <span className="font-semibold text-success">{formatINR(seriesTotals.inflow)} in</span>, <span className="font-semibold text-maroon">{formatINR(seriesTotals.outflow)} out</span>.
              </p>
              <div className="h-64 w-full overflow-hidden" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ebe2d0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b665c' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b665c' }} tickFormatter={v => formatINRCompact(Number(v))} width={56} />
                    <Tooltip
                      cursor={{ fill: '#f1e9da' }}
                      contentStyle={{ borderRadius: 10, border: '1px solid #ddd0b6', boxShadow: '0 10px 28px -12px rgba(25,43,74,.28)', fontSize: 13 }}
                      formatter={(value, name) => [formatINR(Number(value ?? 0)), String(name ?? '')]}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="inflow" name="Money in" fill="#77856a" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="outflow" name="Money out" fill="#762f35" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="sr-only">
                <caption>Cash flow this {range.toLowerCase()}</caption>
                <thead><tr><th scope="col">Period</th><th scope="col">Money in</th><th scope="col">Money out</th><th scope="col">Net</th></tr></thead>
                <tbody>
                  {series.map(p => <tr key={p.label}><th scope="row">{p.label}</th><td>{formatINR(p.inflow)}</td><td>{formatINR(p.outflow)}</td><td>{formatINR(p.net)}</td></tr>)}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Stock health */}
          <Card className="lg:col-span-4">
            <CardHeader title="Stock" description={`${inventory.length} ${inventory.length === 1 ? 'item' : 'items'} · ${formatINR(inventoryValuation(inventory))} at cost`} icon={Package} action={<Button variant="ghost" size="sm" iconRight={ArrowRight} onClick={() => navigate('/inventory')}>Manage</Button>} />
            <div className="p-5">
              <div className="mb-4 flex gap-2">
                <Badge tone={outOfStock > 0 ? 'danger' : 'neutral'}>{outOfStock} out of stock</Badge>
                <Badge tone={lowStock.length - outOfStock > 0 ? 'warning' : 'neutral'}>{lowStock.length - outOfStock} running low</Badge>
              </div>
              {lowStock.length === 0 ? (
                <p className="text-sm text-ink-muted">{inventory.length === 0 ? 'No stock recorded yet.' : 'All items are well stocked.'}</p>
              ) : (
                <ul className="divide-y divide-line-soft">
                  {lowStock.slice(0, 5).map(i => (
                    <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0 truncate text-sm font-medium">{i.item}</span>
                      <span className="flex items-center gap-2">
                        <span className="ms-num text-sm font-semibold">{i.quantity}</span>
                        <Badge tone={i.quantity <= 0 ? 'danger' : 'warning'}>{i.quantity <= 0 ? 'Out' : 'Low'}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {/* Recent activity */}
          <Card className="lg:col-span-7">
            <CardHeader title="Recent activity" icon={BookOpen} action={<Button variant="ghost" size="sm" iconRight={ArrowRight} onClick={() => navigate('/reports')}>Statements</Button>} />
            {recent.length === 0 ? (
              <EmptyState icon={BookOpen} title="No entries yet" />
            ) : (
              <ol className="relative px-5 py-3">
                <span aria-hidden className="absolute bottom-6 left-[29px] top-6 w-px bg-line" />
                {recent.map(e => {
                  const inflow = isInflow(e.type);
                  return (
                    <li key={`${e.payment_status}-${e.id}`} className="relative flex items-start gap-4 py-2.5">
                      <span aria-hidden className={cx('relative z-10 mt-0.5 flex size-[18px] items-center justify-center rounded-full ring-4 ring-surface', inflow ? 'bg-sage' : 'bg-maroon')}>
                        {inflow ? <ArrowDownLeft className="size-3 text-white" /> : <ArrowUpRight className="size-3 text-white" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{e.item}</p>
                        <p className="text-xs text-ink-muted">
                          {ENTRY_TYPE_LABELS[e.type]} · {formatDateTime(e.created_at)}
                          {e.payment_status === 'PENDING' && <> · <span className="font-semibold text-warning">Udhaar</span></>}
                        </p>
                      </div>
                      <Money value={e.amount} direction={inflow ? 'in' : 'out'} showSign className="text-sm font-semibold" />
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          {/* This month */}
          <Card className="lg:col-span-5">
            <CardHeader title="This month" description={now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} icon={Wallet} />
            <dl className="divide-y divide-line-soft px-5">
              {[
                { label: 'Sales', value: month.sales, tone: 'text-success' },
                { label: 'Stock purchases', value: month.stockExpenses, tone: 'text-maroon' },
                { label: 'Other expenses', value: month.otherExpenses, tone: 'text-maroon' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-3">
                  <dt className="text-sm text-ink-muted">{row.label}</dt>
                  <dd className={cx('ms-num text-sm font-semibold', row.tone)}>{formatINR(row.value)}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between py-3.5">
                <dt className="text-sm font-semibold">Net {month.net >= 0 ? 'profit' : 'loss'}</dt>
                <dd className={cx('ms-num text-xl font-semibold', month.net >= 0 ? 'text-ink' : 'text-danger')}>{formatINR(Math.abs(month.net))}</dd>
              </div>
            </dl>
          </Card>
        </div>
      )}
    </PageContainer>
  );
};
