import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, CheckCircle2, HandCoins, Pencil, Search, Trash2 } from 'lucide-react';
import type { LedgerEntry } from '../../types';
import { storage } from '../../services/storage';
import { errorMessage } from '../../services/api';
import { useApp } from '../layout/AppContext';
import { PageContainer } from '../layout/AppShell';
import { Button, IconButton } from '../ui/Button';
import { Checkbox, Input, SegmentedControl } from '../ui/Form';
import { ConfirmDialog } from '../ui/Modal';
import { Badge, Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from '../ui/Surface';
import { useToast } from '../ui/Toast';
import { LedgerEntryForm } from './LedgerEntryForm';
import { ENTRY_TYPE_LABELS, duesDirection, stockEffect, summarizeDues } from '../../lib/ledger';
import { formatDate } from '../../lib/dates';
import { formatINR } from '../../lib/money';
import { cx } from '../../lib/cx';

type Tab = 'RECEIVABLE' | 'PAYABLE';

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));
}

export const UdhaarTracker: React.FC = () => {
  const { dataVersion, notifyDataChanged } = useApp();
  const toast = useToast();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('RECEIVABLE');
  const [search, setSearch] = useState('');
  const [settling, setSettling] = useState<LedgerEntry | null>(null);
  const [editing, setEditing] = useState<LedgerEntry | null>(null);
  const [deleting, setDeleting] = useState<LedgerEntry | null>(null);
  const [revertStock, setRevertStock] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setEntries(await storage.getUdhaarEntries());
      setStatus('ready');
    } catch (err) {
      setError(errorMessage(err, 'Could not load udhaar.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, dataVersion]);

  const dues = useMemo(() => summarizeDues(entries), [entries]);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter(e => duesDirection(e.type) === tab && (!term || (e.customer_name || '').toLowerCase().includes(term) || e.item.toLowerCase().includes(term)));
  }, [entries, tab, search]);

  const settle = async () => {
    if (!settling) return;
    setBusy(true);
    try {
      await storage.settleUdhaar(settling.id);
      toast.success('Marked as settled', `${formatINR(settling.amount)} moved into today’s ledger.`);
      setSettling(null);
      notifyDataChanged();
    } catch (err) {
      toast.error('Could not settle', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await storage.deleteLedgerEntry('udhaar_entries', deleting.id, { revertStock: stockEffect(deleting) !== 0 && revertStock });
      toast.success('Udhaar entry deleted');
      setDeleting(null);
      notifyDataChanged();
    } catch (err) {
      toast.error('Could not delete', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer wide>
      <PageHeader title="Udhaar" />

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Card as="div" className={cx('relative overflow-hidden p-5', tab === 'RECEIVABLE' && 'ring-1 ring-success/30')}>
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink-muted"><ArrowDownLeft aria-hidden className="size-4 text-success" /> To collect</p>
          <p className="ms-num mt-1 font-display text-4xl font-semibold text-success">{formatINR(dues.receivable)}</p>
          <p className="mt-1 text-sm text-ink-muted">{dues.receivableCount} open {dues.receivableCount === 1 ? 'entry' : 'entries'} — customers and people who owe you</p>
        </Card>
        <Card as="div" className={cx('relative overflow-hidden p-5', tab === 'PAYABLE' && 'ring-1 ring-maroon/30')}>
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink-muted"><ArrowUpRight aria-hidden className="size-4 text-maroon" /> To pay</p>
          <p className="ms-num mt-1 font-display text-4xl font-semibold text-maroon">{formatINR(dues.payable)}</p>
          <p className="mt-1 text-sm text-ink-muted">{dues.payableCount} open {dues.payableCount === 1 ? 'entry' : 'entries'} — suppliers and people you owe</p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-line-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl label="Direction" value={tab} onChange={setTab} options={[{ value: 'RECEIVABLE', label: `To collect (${dues.receivableCount})` }, { value: 'PAYABLE', label: `To pay (${dues.payableCount})` }]} />
          <div className="sm:w-72">
            <Input type="search" aria-label="Search udhaar" placeholder="Search name or item" value={search} onChange={e => setSearch(e.target.value)} leading={<Search className="size-4" />} />
          </div>
        </div>

        {status === 'loading' && <LoadingBlock label="Loading udhaar" />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {status === 'ready' && visible.length === 0 && (
          <EmptyState
            icon={HandCoins}
            title={entries.length === 0 ? 'No open udhaar' : search ? 'No entries match' : tab === 'RECEIVABLE' ? 'Nobody owes you right now' : 'You owe nothing right now'}
            
          />
        )}

        {status === 'ready' && visible.length > 0 && (
          <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map(e => {
              const age = daysSince(e.created_at);
              return (
                <li key={e.id}>
                  <Card as="article" interactive className="flex h-full flex-col p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-sans text-base font-semibold">{e.customer_name || e.item}</h3>
                        <p className="truncate text-sm text-ink-muted">
                          {e.customer_name ? e.item : ENTRY_TYPE_LABELS[e.type]}
                          {e.category === 'BUSINESS' && e.quantity > 1 && <span className="ms-num"> · {e.quantity} pcs</span>}
                        </p>
                      </div>
                      <p className={cx('ms-num shrink-0 font-display text-xl font-semibold', tab === 'RECEIVABLE' ? 'text-success' : 'text-maroon')}>{formatINR(e.amount)}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                      <Badge tone="neutral">{ENTRY_TYPE_LABELS[e.type]}</Badge>
                      <span className="inline-flex items-center gap-1"><CalendarDays aria-hidden className="size-3.5" /> {formatDate(e.created_at)}</span>
                      {age >= 30 && <Badge tone="warning">{age} days old</Badge>}
                    </div>
                    <div className="mt-4 flex items-center gap-1 border-t border-line-soft pt-3">
                      <Button size="sm" variant={tab === 'RECEIVABLE' ? 'primary' : 'accent'} icon={CheckCircle2} onClick={() => setSettling(e)} className="flex-1">
                        {tab === 'RECEIVABLE' ? 'Mark received' : 'Mark paid'}
                      </Button>
                      <IconButton icon={Pencil} size="sm" label={`Edit ${e.customer_name || e.item}`} onClick={() => setEditing(e)} />
                      <IconButton icon={Trash2} size="sm" tone="danger" label={`Delete ${e.customer_name || e.item}`} onClick={() => { setRevertStock(true); setDeleting(e); }} />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={!!settling}
        title={tab === 'RECEIVABLE' ? 'Payment received?' : 'Payment made?'}
        confirmLabel={tab === 'RECEIVABLE' ? 'Yes, received in full' : 'Yes, paid in full'}
        loading={busy}
        onCancel={() => setSettling(null)}
        onConfirm={settle}
        message={settling && (
          <>
            <strong className="text-ink">{formatINR(settling.amount)}</strong> {tab === 'RECEIVABLE' ? 'from' : 'to'} <strong className="text-ink">{settling.customer_name || settling.item}</strong> for “{settling.item}”.
            It will be recorded in today’s ledger as paid. Stock is not changed again.
          </>
        )}
      />

      <ConfirmDialog
        open={!!deleting}
        tone="danger"
        title="Delete this udhaar entry?"
        confirmLabel="Delete"
        loading={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={remove}
        message={deleting && <>“{deleting.item}” — {formatINR(deleting.amount)}{deleting.customer_name ? ` (${deleting.customer_name})` : ''}. Use this only for mistakes; to record payment, mark it as settled instead.</>}
      >
        {deleting && stockEffect(deleting) !== 0 && (
          <Checkbox checked={revertStock} onChange={setRevertStock} label={deleting.type === 'SALE' ? `Put ${deleting.quantity} back into stock` : `Remove ${deleting.quantity} from stock`} />
        )}
      </ConfirmDialog>

      {editing && (
        <LedgerEntryForm
          open
          entry={editing}
          entryCollection="udhaar_entries"
          onClose={() => setEditing(null)}
          onSaved={msg => {
            setEditing(null);
            toast.success(msg);
            notifyDataChanged();
          }}
        />
      )}
    </PageContainer>
  );
};
