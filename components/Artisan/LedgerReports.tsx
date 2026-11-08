import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import type { LedgerEntry } from '../../types';
import { storage } from '../../services/storage';
import { errorMessage } from '../../services/api';
import { useApp } from '../layout/AppContext';
import { PageContainer } from '../layout/AppShell';
import { Button } from '../ui/Button';
import { Field, Input, SegmentedControl } from '../ui/Form';
import { Card, EmptyState, ErrorState, LoadingBlock, PageHeader, StatTile } from '../ui/Surface';
import { useToast } from '../ui/Toast';
import { ENTRY_TYPE_LABELS, isInflow, summarizeBusiness, summarizeCash } from '../../lib/ledger';
import { addDays, formatDateKey, formatDateTime, isValidDateKey, localDateKey } from '../../lib/dates';
import { formatINR, roundMoney } from '../../lib/money';
import { escapeHtml, toCsv } from '../../lib/text';
import { cx } from '../../lib/cx';

type Preset = 'today' | 'week' | 'month' | 'last-month' | 'custom';

function presetRange(preset: Exclude<Preset, 'custom'>): [string, string] {
  const today = localDateKey();
  const now = new Date();
  if (preset === 'today') return [today, today];
  if (preset === 'week') {
    const dow = now.getDay();
    return [addDays(today, -(dow === 0 ? 6 : dow - 1)), today];
  }
  if (preset === 'month') return [`${today.slice(0, 7)}-01`, today];
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  return [localDateKey(first), localDateKey(last)];
}

export const LedgerReports: React.FC = () => {
  const { user, dataVersion } = useApp();
  const toast = useToast();
  const today = localDateKey();
  const [preset, setPreset] = useState<Preset>('month');
  const [[from, to], setRange] = useState<[string, string]>(() => presetRange('month'));
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  const rangeError = !isValidDateKey(from) || !isValidDateKey(to)
    ? 'Choose both dates.'
    : from > to ? '“From” must be on or before “To”.' : to > today ? 'Reports cannot include future dates.' : '';

  const load = useCallback(async () => {
    if (rangeError) return;
    setStatus('loading');
    try {
      const data = await storage.getLedgerRange(from, to);
      setEntries([...data].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)));
      setStatus('ready');
    } catch (err) {
      setError(errorMessage(err, 'Could not load the statement.'));
      setStatus('error');
    }
  }, [from, to, rangeError]);

  useEffect(() => {
    void load();
  }, [load, dataVersion]);

  const cash = useMemo(() => summarizeCash(entries), [entries]);
  const business = useMemo(() => summarizeBusiness(entries), [entries]);
  const rows = useMemo(() => {
    let balance = 0;
    return entries.map(e => {
      balance = roundMoney(balance + (isInflow(e.type) ? e.amount : -e.amount));
      return { entry: e, balance };
    });
  }, [entries]);

  const choosePreset = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') setRange(presetRange(p));
  };

  const periodLabel = from === to ? formatDateKey(from) : `${formatDateKey(from)} – ${formatDateKey(to)}`;

  const downloadCsv = () => {
    const csv = toCsv([
      ['Date & time', 'Particulars', 'Customer', 'Type', 'Quantity', 'Rate (INR)', 'In (INR)', 'Out (INR)', 'Balance (INR)'],
      ...rows.map(({ entry: e, balance }) => [
        new Date(e.created_at).toLocaleString('en-IN'),
        e.item,
        e.customer_name || '',
        ENTRY_TYPE_LABELS[e.type],
        e.quantity,
        e.unit_price,
        isInflow(e.type) ? e.amount : '',
        isInflow(e.type) ? '' : e.amount,
        balance,
      ]),
      [],
      ['Total in', cash.inflow],
      ['Total out', cash.outflow],
      ['Net', cash.net],
    ]);
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mewar-sync-ledger_${from}_to_${to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const print = () => {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) {
      toast.error('Pop-up blocked', 'Allow pop-ups for this site to print the statement.');
      return;
    }
    // Every user-supplied value is HTML-escaped; no scripts are written.
    const body = rows.map(({ entry: e, balance }) => `
      <tr>
        <td>${escapeHtml(formatDateTime(e.created_at))}</td>
        <td><strong>${escapeHtml(e.item)}</strong>${e.customer_name ? `<br><small>${escapeHtml(e.customer_name)}</small>` : ''}</td>
        <td>${escapeHtml(ENTRY_TYPE_LABELS[e.type])}</td>
        <td class="num in">${isInflow(e.type) ? escapeHtml(formatINR(e.amount)) : ''}</td>
        <td class="num out">${isInflow(e.type) ? '' : escapeHtml(formatINR(e.amount))}</td>
        <td class="num">${escapeHtml(formatINR(balance))}</td>
      </tr>`).join('');
    w.document.open();
    w.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(`Ledger statement — ${periodLabel}`)}</title>
      <style>
        body{font-family:Georgia,'Times New Roman',serif;color:#292824;margin:32px}
        header{text-align:center;border-bottom:3px double #c49a52;padding-bottom:14px;margin-bottom:18px}
        h1{font-size:24px;margin:0;color:#192b4a} .sub{letter-spacing:.2em;text-transform:uppercase;font-size:11px;color:#7a5c24;margin-top:6px}
        .meta{display:flex;justify-content:space-between;font:12px system-ui,sans-serif;margin-bottom:14px}
        table{width:100%;border-collapse:collapse;font:12px system-ui,sans-serif}
        th,td{border-bottom:1px solid #e8ddc8;padding:7px 6px;text-align:left;vertical-align:top}
        th{background:#f1e9da;text-transform:uppercase;font-size:10px;letter-spacing:.08em}
        .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap} .in{color:#3f6b3a} .out{color:#762f35}
        .totals{margin-top:18px;margin-left:auto;width:280px;font:13px system-ui,sans-serif}
        .totals div{display:flex;justify-content:space-between;padding:4px 0} .totals .net{border-top:2px solid #c49a52;font-weight:700;margin-top:4px;padding-top:8px}
        footer{margin-top:36px;font:10px system-ui,sans-serif;color:#8f897c;text-align:center}
      </style></head><body>
      <header><h1>${escapeHtml(user.name)}</h1><div class="sub">Bahi-khata ledger statement</div></header>
      <div class="meta"><span>Period: ${escapeHtml(periodLabel)}</span><span>${rows.length} entries</span></div>
      <table><thead><tr><th>Date</th><th>Particulars</th><th>Type</th><th class="num">In (jama)</th><th class="num">Out (kharch)</th><th class="num">Balance</th></tr></thead><tbody>${body}</tbody></table>
      <div class="totals"><div><span>Total in</span><span>${escapeHtml(formatINR(cash.inflow))}</span></div><div><span>Total out</span><span>${escapeHtml(formatINR(cash.outflow))}</span></div><div class="net"><span>Net</span><span>${escapeHtml(formatINR(cash.net))}</span></div></div>
      <footer>Generated by Mewar Sync on ${escapeHtml(new Date().toLocaleString('en-IN'))}. Paid entries only; open udhaar is listed separately.</footer>
      </body></html>`);
    w.document.close();
    w.focus();
    window.setTimeout(() => w.print(), 300);
  };

  return (
    <PageContainer wide>
      <PageHeader
        title="Reports"
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={downloadCsv} disabled={status !== 'ready' || entries.length === 0}>Download CSV</Button>
            <Button icon={Printer} onClick={print} disabled={status !== 'ready' || entries.length === 0}>Print</Button>
          </>
        }
      />

      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="ms-no-scrollbar -mx-1 overflow-x-auto px-1">
            <SegmentedControl
              label="Period"
              value={preset}
              onChange={choosePreset}
              options={[
                { value: 'today', label: 'Today' },
                { value: 'week', label: 'This week' },
                { value: 'month', label: 'This month' },
                { value: 'last-month', label: 'Last month' },
                { value: 'custom', label: 'Custom' },
              ]}
            />
          </div>
          <div className="grid flex-1 grid-cols-2 gap-3 sm:max-w-md">
            <Field label="From">
              <Input type="date" value={from} max={today} onChange={e => { setPreset('custom'); setRange([e.target.value, to]); }} />
            </Field>
            <Field label="To">
              <Input type="date" value={to} max={today} onChange={e => { setPreset('custom'); setRange([from, e.target.value]); }} />
            </Field>
          </div>
        </div>
        {rangeError && <p role="alert" className="mt-3 text-sm font-medium text-danger">{rangeError}</p>}
      </Card>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Money in" value={<span className="text-success">{formatINR(cash.inflow)}</span>} tone="sage" />
        <StatTile label="Money out" value={<span className="text-maroon">{formatINR(cash.outflow)}</span>} tone="maroon" />
        <StatTile label="Net cash" value={<span className={cash.net < 0 ? 'text-danger' : undefined}>{cash.net < 0 ? '−' : ''}{formatINR(Math.abs(cash.net))}</span>} tone="indigo" />
        <StatTile label={business.net >= 0 ? 'Business profit' : 'Business loss'} value={formatINR(Math.abs(business.net))} sub={`Sales ${formatINR(business.sales)}`} tone="gold" />
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Statement</h2>
            <p className="text-sm text-ink-muted">{periodLabel} · {entries.length} entries</p>
          </div>
        </div>
        {!rangeError && status === 'loading' && <LoadingBlock label="Loading statement" />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {!rangeError && status === 'ready' && entries.length === 0 && <EmptyState icon={FileText} title="No entries in this period" description="Try another period." />}
        {!rangeError && status === 'ready' && entries.length > 0 && (
          <div className="ms-scroll-thin overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">Ledger statement for {periodLabel}</caption>
              <thead className="border-b border-line-soft bg-parchment-soft/50 text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Particulars</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Type</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">In (jama)</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Out (kharch)</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {rows.map(({ entry: e, balance }) => (
                  <tr key={e.id} className="hover:bg-parchment-soft/40">
                    <td className="ms-num whitespace-nowrap px-4 py-2.5 text-ink-muted">{formatDateTime(e.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{e.item}</span>
                      {e.customer_name && <span className="block text-xs text-ink-muted">{e.customer_name}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{ENTRY_TYPE_LABELS[e.type]}</td>
                    <td className="ms-num px-4 py-2.5 text-right text-success">{isInflow(e.type) ? formatINR(e.amount) : ''}</td>
                    <td className="ms-num px-4 py-2.5 text-right text-maroon">{isInflow(e.type) ? '' : formatINR(e.amount)}</td>
                    <td className={cx('ms-num px-4 py-2.5 text-right font-semibold', balance < 0 && 'text-danger')}>{formatINR(balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gold/60 bg-gold-soft/40 font-semibold">
                <tr>
                  <th scope="row" colSpan={3} className="px-4 py-3">Totals</th>
                  <td className="ms-num px-4 py-3 text-right text-success">{formatINR(cash.inflow)}</td>
                  <td className="ms-num px-4 py-3 text-right text-maroon">{formatINR(cash.outflow)}</td>
                  <td className={cx('ms-num px-4 py-3 text-right', cash.net < 0 && 'text-danger')}>{formatINR(cash.net)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </PageContainer>
  );
};
