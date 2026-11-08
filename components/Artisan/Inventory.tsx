import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownUp, Boxes, CircleSlash, Combine, Hammer, Package, Pencil, Plus, Search, ShoppingBag, Trash2, Wallet } from 'lucide-react';
import type { InventoryItem } from '../../types';
import { storage } from '../../services/storage';
import { errorMessage } from '../../services/api';
import { useApp } from '../layout/AppContext';
import { PageContainer } from '../layout/AppShell';
import { Button, IconButton } from '../ui/Button';
import { Input, Select, SegmentedControl } from '../ui/Form';
import { ConfirmDialog } from '../ui/Modal';
import { Badge, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, StatTile } from '../ui/Surface';
import { useToast } from '../ui/Toast';
import { InventoryForm } from './InventoryForm';
import { findDuplicateGroups, inventoryValuation, stockStatus, type StockStatus } from '../../lib/inventory';
import { formatINR, formatQuantity, roundMoney } from '../../lib/money';
import { formatDate } from '../../lib/dates';

type SourceFilter = 'ALL' | 'PURCHASED' | 'PRODUCED';
type Sort = 'name' | 'stock-asc' | 'stock-desc' | 'value-desc';

function StockBadge({ status }: { status: StockStatus }) {
  if (status === 'OUT') return <Badge tone="danger" icon={CircleSlash}>Out of stock</Badge>;
  if (status === 'LOW') return <Badge tone="warning" icon={AlertTriangle}>Low</Badge>;
  return <Badge tone="sage">In stock</Badge>;
}

export const Inventory: React.FC = () => {
  const { dataVersion, notifyDataChanged } = useApp();
  const toast = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [source, setSource] = useState<SourceFilter>('ALL');
  const [sort, setSort] = useState<Sort>('name');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<{ open: boolean; item?: InventoryItem }>({ open: false });
  const [deleting, setDeleting] = useState<InventoryItem | null>(null);
  const [merging, setMerging] = useState(false);
  const [confirmMerge, setConfirmMerge] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await storage.getInventory());
      setStatus('ready');
    } catch (err) {
      setError(errorMessage(err, 'Could not load inventory.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, dataVersion]);

  const duplicates = useMemo(() => findDuplicateGroups(items), [items]);
  const lowCount = items.filter(i => stockStatus(i.quantity) === 'LOW').length;
  const outCount = items.filter(i => stockStatus(i.quantity) === 'OUT').length;

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = items.filter(i => {
      if (source === 'PURCHASED' && !i.is_purchased) return false;
      if (source === 'PRODUCED' && i.is_purchased) return false;
      return !term || i.item.toLowerCase().includes(term);
    });
    const value = (i: InventoryItem) => i.quantity * i.unit_cost;
    return list.sort((a, b) => {
      if (sort === 'stock-asc') return a.quantity - b.quantity;
      if (sort === 'stock-desc') return b.quantity - a.quantity;
      if (sort === 'value-desc') return value(b) - value(a);
      return a.item.localeCompare(b.item);
    });
  }, [items, search, source, sort]);

  const doDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await storage.deleteInventoryItem(deleting.id);
      toast.success(`“${deleting.item}” removed`, 'Past ledger entries keep their record of it.');
      setDeleting(null);
      notifyDataChanged();
    } catch (err) {
      toast.error('Could not remove the item', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const doMerge = async () => {
    setMerging(true);
    try {
      const count = await storage.mergeInventory();
      toast.success(count > 0 ? `${count} duplicate ${count === 1 ? 'record' : 'records'} merged` : 'Nothing to merge');
      setConfirmMerge(false);
      notifyDataChanged();
    } catch (err) {
      toast.error('Could not merge', errorMessage(err));
    } finally {
      setMerging(false);
    }
  };

  return (
    <PageContainer wide>
      <PageHeader
        title="Inventory"
        actions={<Button icon={Plus} onClick={() => setForm({ open: true })}>Add stock</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Stock value (at cost)" value={formatINR(inventoryValuation(items))} icon={Wallet} tone="indigo" />
        <StatTile label="Items" value={items.length} icon={Boxes} tone="gold" />
        <StatTile label="Running low" value={lowCount} sub="Fewer than 5 left" icon={AlertTriangle} tone="terracotta" />
        <StatTile label="Out of stock" value={outCount} icon={CircleSlash} tone="maroon" />
      </div>

      {duplicates.length > 0 && (
        <div role="status" className="mb-5 flex flex-col gap-3 rounded-lg border border-gold/40 bg-gold-soft/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-soft">
            <span className="font-semibold text-ink">{duplicates.length} duplicate {duplicates.length === 1 ? 'item' : 'items'}</span> found.
          </p>
          <Button variant="secondary" size="sm" icon={Combine} onClick={() => setConfirmMerge(true)}>Review & merge</Button>
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b border-line-soft p-4 xl:flex-row xl:items-center xl:justify-between">
          <SegmentedControl
            label="Source"
            size="sm"
            value={source}
            onChange={setSource}
            options={[{ value: 'ALL', label: 'All' }, { value: 'PURCHASED', label: 'Purchased', icon: ShoppingBag }, { value: 'PRODUCED', label: 'Made', icon: Hammer }]}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="sm:w-64">
              <Input type="search" aria-label="Search stock" placeholder="Search items" value={search} onChange={e => setSearch(e.target.value)} leading={<Search className="size-4" />} />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <ArrowDownUp aria-hidden className="size-4" />
              <span className="sr-only">Sort by</span>
              <Select aria-label="Sort by" value={sort} onChange={e => setSort(e.target.value as Sort)} className="sm:w-48">
                <option value="name">Name (A–Z)</option>
                <option value="stock-asc">Lowest stock first</option>
                <option value="stock-desc">Highest stock first</option>
                <option value="value-desc">Highest value first</option>
              </Select>
            </label>
          </div>
        </div>

        {status === 'loading' && <LoadingBlock label="Loading stock" />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {status === 'ready' && visible.length === 0 && (
          <EmptyState
            icon={Package}
            title={items.length === 0 ? 'No stock recorded yet' : 'No items match'}
            description={items.length === 0 ? undefined : 'Try another search or filter.'}
            action={items.length === 0 ? <Button variant="secondary" icon={Plus} onClick={() => setForm({ open: true })}>Add your first item</Button> : undefined}
          />
        )}

        {status === 'ready' && visible.length > 0 && (
          <>
            <div className="hidden md:block">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Inventory items</caption>
                <thead className="border-b border-line-soft bg-parchment-soft/50 text-xs uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Item</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Source</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">In stock</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Unit cost</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Value</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {visible.map(i => (
                    <tr key={i.id} className="hover:bg-parchment-soft/40">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{i.item}</p>
                        <p className="text-xs text-ink-muted">Updated {formatDate(i.last_updated)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={i.is_purchased ? 'info' : 'gold'} icon={i.is_purchased ? ShoppingBag : Hammer}>{i.is_purchased ? 'Purchased' : 'Made'}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="ms-num font-semibold">{formatQuantity(i.quantity)}</span>
                          <StockBadge status={stockStatus(i.quantity)} />
                        </div>
                      </td>
                      <td className="ms-num px-4 py-3 text-right text-ink-muted">{formatINR(i.unit_cost)}</td>
                      <td className="ms-num px-4 py-3 text-right font-semibold">{formatINR(roundMoney(i.quantity * i.unit_cost))}</td>
                      <td className="px-2 py-2 text-right">
                        <div className="inline-flex">
                          <IconButton icon={Pencil} size="sm" label={`Edit ${i.item}`} onClick={() => setForm({ open: true, item: i })} />
                          <IconButton icon={Trash2} size="sm" tone="danger" label={`Remove ${i.item}`} onClick={() => setDeleting(i)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line-soft md:hidden">
              {visible.map(i => (
                <li key={i.id} className="flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{i.item}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <StockBadge status={stockStatus(i.quantity)} />
                      <Badge tone={i.is_purchased ? 'info' : 'gold'}>{i.is_purchased ? 'Purchased' : 'Made'}</Badge>
                    </div>
                    <p className="ms-num mt-2 text-sm text-ink-muted">
                      <span className="font-semibold text-ink">{formatQuantity(i.quantity)}</span> × {formatINR(i.unit_cost)} = {formatINR(roundMoney(i.quantity * i.unit_cost))}
                    </p>
                  </div>
                  <div className="-mr-2 flex">
                    <IconButton icon={Pencil} size="sm" label={`Edit ${i.item}`} onClick={() => setForm({ open: true, item: i })} />
                    <IconButton icon={Trash2} size="sm" tone="danger" label={`Remove ${i.item}`} onClick={() => setDeleting(i)} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {form.open && (
        <InventoryForm
          open
          item={form.item}
          onClose={() => setForm({ open: false })}
          onSaved={msg => {
            setForm({ open: false });
            toast.success(msg);
            notifyDataChanged();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        tone="danger"
        title="Remove this stock item?"
        confirmLabel="Remove item"
        loading={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={doDelete}
        message={deleting && <>“{deleting.item}” ({deleting.quantity} in stock) will be removed from inventory. Ledger history that mentions it is kept.</>}
      />

      <ConfirmDialog
        open={confirmMerge}
        title="Merge duplicate items?"
        confirmLabel="Merge"
        loading={merging}
        onCancel={() => setConfirmMerge(false)}
        onConfirm={doMerge}
        message="These records share the same name, source and unit cost. Each group becomes one item with the combined quantity:"
      >
        <ul className="list-disc space-y-1 pl-5">
          {duplicates.map(g => (
            <li key={g[0].id}>
              {g.map(i => `“${i.item}” (${i.quantity})`).join(' + ')} → {g.reduce((s, i) => s + i.quantity, 0)}
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </PageContainer>
  );
};
