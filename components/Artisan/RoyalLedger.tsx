import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Briefcase, CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2, TrendingDown, TrendingUp, User } from 'lucide-react';
import type { EntryCategory, EntryType, InventoryItem, LedgerEntry } from '../../types';
import { storage } from '../../services/storage';
import { errorMessage } from '../../services/api';
import { useApp } from '../layout/AppContext';
import { PageContainer } from '../layout/AppShell';
import { Button, IconButton } from '../ui/Button';
import { Checkbox, Input, SegmentedControl } from '../ui/Form';
import { ConfirmDialog } from '../ui/Modal';
import { Badge, Card, EmptyState, ErrorState, LoadingBlock, Money, PageHeader, StatTile } from '../ui/Surface';
import { useToast } from '../ui/Toast';
import { LedgerEntryForm } from './LedgerEntryForm';
import { ENTRY_TYPE_LABELS, categoryForType, isInflow, saleMargin, stockEffect, summarizeBusiness, summarizeCash, summarizePersonal } from '../../lib/ledger';
import { addDays, formatDateKey, formatTime, isValidDateKey, localDateKey } from '../../lib/dates';
import { formatINR, formatQuantity } from '../../lib/money';
import { cx } from '../../lib/cx';

type Filter = 'ALL' | EntryType;

const TYPE_TONE: Record<EntryType, 'success' | 'maroon' | 'terracotta' | 'info' | 'gold'> = {
  SALE: 'success',
  BUSINESS_EXPENSE: 'terracotta',
  OTHER_EXPENSE: 'maroon',
  PERSONAL_RECEIVED: 'info',
  PERSONAL_PAID: 'gold',
};

export const RoyalLedger: React.FC = () => {
  const { dataVersion, notifyDataChanged } = useApp();
  const toast = useToast();
  const today = localDateKey();
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<EntryCategory>('BUSINESS');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LedgerEntry | null>(null);
  const [deleting, setDeleting] = useState<LedgerEntry | null>(null);
  const [revertStock, setRevertStock] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus(s => (s === 'ready' ? 'ready' : 'loading'));
    try {
      const [l, inv] = await Promise.all([storage.getLedgerRange(date, date), storage.getInventory()]);
      setEntries(l);
      setInventory(inv);
      setStatus('ready');
    } catch (err) {
      setError(errorMessage(err, 'Could not load the ledger.'));
      setStatus('error');
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load, dataVersion]);

  const inCategory = useMemo(() => entries.filter(e => categoryForType(e.type) === category), [entries, category]);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return inCategory.filter(e => (filter === 'ALL' || e.type === filter) && (!term || e.item.toLowerCase().includes(term) || (e.customer_name || '').toLowerCase().includes(term)));
  }, [inCategory, filter, search]);

  const business = useMemo(() => summarizeBusiness(inCategory), [inCategory]);
  const personal = useMemo(() => summarizePersonal(inCategory), [inCategory]);
  const cash = useMemo(() => summarizeCash(entries), [entries]);

  const changeDate = (key: string) => {
    if (isValidDateKey(key) && key <= today) setDate(key);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await storage.deleteLedgerEntry('ledger_entries', deleting.id, { revertStock: stockEffect(deleting) !== 0 && revertStock });
      toast.success('Entry deleted', stockEffect(deleting) !== 0 && revertStock ? 'Stock was adjusted.' : undefined);
      setDeleting(null);
      notifyDataChanged();
    } catch (err) {
      toast.error('Could not delete', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const filters: { value: Filter; label: string }[] = category === 'BUSINESS'
    ? [{ value: 'ALL', label: 'All' }, { value: 'SALE', label: 'Sales' }, { value: 'BUSINESS_EXPENSE', label: 'Stock' }, { value: 'OTHER_EXPENSE', label: 'Other' }]
    : [{ value: 'ALL', label: 'All' }, { value: 'PERSONAL_RECEIVED', label: 'Received' }, { value: 'PERSONAL_PAID', label: 'Given' }];

  return (
    <PageContainer wide>
      <PageHeader
        title="Ledger"
        actions={<Button icon={Plus} onClick={() => { setEditing(null); setFormOpen(true); }}>New entry</Button>}
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedControl
          label="Ledger book"
          value={category}
          onChange={c => { setCategory(c); setFilter('ALL'); }}
          options={[{ value: 'BUSINESS', label: 'Business', icon: Briefcase }, { value: 'PERSONAL', label: 'Personal', icon: User }]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <IconButton icon={ChevronLeft} label="Previous day" onClick={() => changeDate(addDays(date, -1))} className="border border-line bg-surface" />
          <label className="relative">
            <span className="sr-only">Ledger date</span>
            <CalendarDays aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="date"
              value={date}
              max={today}
              onChange={e => changeDate(e.target.value)}
              className="h-11 rounded-md border border-line bg-surface pl-9 pr-3 text-[15px] focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/15"
            />
          </label>
          <IconButton icon={ChevronRight} label="Next day" onClick={() => changeDate(addDays(date, 1))} disabled={date >= today} className="border border-line bg-surface" />
          {date !== today && <Button variant="ghost" size="sm" onClick={() => setDate(today)}>Today</Button>}
        </div>
      </div>

      <h2 className="mb-3 text-lg font-semibold">
        {date === today ? 'Today' : formatDateKey(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </h2>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {category === 'BUSINESS' ? (
          <>
            <StatTile label="Sales" value={formatINR(business.sales)} icon={TrendingUp} tone="sage" />
            <StatTile label="Stock purchases" value={formatINR(business.stockExpenses)} icon={TrendingDown} tone="terracotta" />
            <StatTile label="Other expenses" value={formatINR(business.otherExpenses)} icon={TrendingDown} tone="maroon" />
            <StatTile label={business.net >= 0 ? 'Net profit' : 'Net loss'} value={<span className={business.net < 0 ? 'text-danger' : undefined}>{formatINR(Math.abs(business.net))}</span>} icon={BookOpen} tone="indigo" />
          </>
        ) : (
          <>
            <StatTile label="Received" value={formatINR(personal.received)} icon={TrendingUp} tone="indigo" />
            <StatTile label="Given" value={formatINR(personal.given)} icon={TrendingDown} tone="gold" />
            <StatTile label="Net" value={<span className={personal.net < 0 ? 'text-danger' : undefined}>{formatINR(Math.abs(personal.net))}</span>} sub={personal.net < 0 ? 'More given than received' : undefined} icon={BookOpen} tone="sage" />
            <StatTile label="Cash for the day" value={<span className={cash.net < 0 ? 'text-danger' : undefined}>{cash.net < 0 ? '−' : ''}{formatINR(Math.abs(cash.net))}</span>} sub="Business and personal" icon={BookOpen} tone="indigo" />
          </>
        )}
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-line-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <div role="group" aria-label="Filter by type" className="ms-no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {filters.map(f => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cx('h-9 shrink-0 rounded-full px-3.5 text-sm font-medium transition-colors duration-200', filter === f.value ? 'bg-ink text-white' : 'bg-black/[0.05] text-ink-soft hover:bg-black/[0.08]')}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="sm:w-64">
            <Input type="search" placeholder="Search item or customer" aria-label="Search entries" value={search} onChange={e => setSearch(e.target.value)} leading={<Search className="size-4" />} />
          </div>
        </div>

        {status === 'loading' && <LoadingBlock label="Loading entries" />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {status === 'ready' && visible.length === 0 && (
          <EmptyState
            icon={BookOpen}
            title={inCategory.length === 0 ? 'No entries for this day' : 'No entries match'}
            description={inCategory.length === 0 ? undefined : 'Try another filter or search.'}
            action={inCategory.length === 0 ? <Button icon={Plus} variant="secondary" onClick={() => { setEditing(null); setFormOpen(true); }}>New entry</Button> : undefined}
          />
        )}

        {status === 'ready' && visible.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Ledger entries for {formatDateKey(date)}</caption>
                <thead className="border-b border-line-soft bg-parchment-soft/50 text-xs uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Time</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Particulars</th>
                    {category === 'BUSINESS' && <th scope="col" className="px-4 py-3 text-right font-semibold">Qty</th>}
                    {category === 'BUSINESS' && <th scope="col" className="px-4 py-3 text-right font-semibold">Rate</th>}
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Amount</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {visible.map(e => {
                    const margin = saleMargin(e, inventory);
                    return (
                      <tr key={e.id} className="hover:bg-parchment-soft/40">
                        <td className="ms-num whitespace-nowrap px-4 py-3 text-ink-muted">{formatTime(e.created_at)}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-ink">{e.item}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge tone={TYPE_TONE[e.type]}>{ENTRY_TYPE_LABELS[e.type]}</Badge>
                            {e.customer_name && <span className="text-xs text-ink-muted">· {e.customer_name}</span>}
                            {margin && (
                              <span className={cx('text-xs font-medium', margin.profit >= 0 ? 'text-success' : 'text-danger')}>
                                · {margin.profit >= 0 ? 'Margin' : 'Loss'} {formatINR(Math.abs(margin.profit))} (cost {formatINR(margin.unitCost)}/pc)
                              </span>
                            )}
                          </div>
                        </td>
                        {category === 'BUSINESS' && <td className="ms-num px-4 py-3 text-right">{formatQuantity(e.quantity)}</td>}
                        {category === 'BUSINESS' && <td className="ms-num px-4 py-3 text-right text-ink-muted">{formatINR(e.unit_price)}</td>}
                        <td className="px-4 py-3 text-right font-semibold"><Money value={e.amount} direction={isInflow(e.type) ? 'in' : 'out'} showSign /></td>
                        <td className="px-2 py-2 text-right">
                          <div className="inline-flex">
                            <IconButton icon={Pencil} size="sm" label={`Edit ${e.item}`} onClick={() => { setEditing(e); setFormOpen(true); }} />
                            <IconButton icon={Trash2} size="sm" tone="danger" label={`Delete ${e.item}`} onClick={() => { setRevertStock(true); setDeleting(e); }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <ul className="divide-y divide-line-soft md:hidden">
              {visible.map(e => (
                <li key={e.id} className="flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{e.item}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                      <Badge tone={TYPE_TONE[e.type]}>{ENTRY_TYPE_LABELS[e.type]}</Badge>
                      <span className="ms-num">{formatTime(e.created_at)}</span>
                      {category === 'BUSINESS' && <span className="ms-num">· {e.quantity} × {formatINR(e.unit_price)}</span>}
                      {e.customer_name && <span>· {e.customer_name}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Money value={e.amount} direction={isInflow(e.type) ? 'in' : 'out'} showSign className="font-semibold" />
                    <div className="-mr-2 flex">
                      <IconButton icon={Pencil} size="sm" label={`Edit ${e.item}`} onClick={() => { setEditing(e); setFormOpen(true); }} />
                      <IconButton icon={Trash2} size="sm" tone="danger" label={`Delete ${e.item}`} onClick={() => { setRevertStock(true); setDeleting(e); }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {formOpen && (
        <LedgerEntryForm
          open
          entry={editing ?? undefined}
          entryCollection="ledger_entries"
          defaultCategory={category}
          onClose={() => setFormOpen(false)}
          onSaved={msg => {
            setFormOpen(false);
            toast.success(msg);
            notifyDataChanged();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        tone="danger"
        title="Delete this entry?"
        confirmLabel="Delete entry"
        loading={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        message={deleting && <>“{deleting.item}” — {formatINR(deleting.amount)}. This permanently removes it from your bahi-khata.</>}
      >
        {deleting && stockEffect(deleting) !== 0 && (
          <Checkbox
            checked={revertStock}
            onChange={setRevertStock}
            label={deleting.type === 'SALE' ? `Put ${deleting.quantity} back into stock` : `Remove ${deleting.quantity} from stock`}
            description="Recommended, so inventory matches your ledger."
          />
        )}
      </ConfirmDialog>
    </PageContainer>
  );
};
