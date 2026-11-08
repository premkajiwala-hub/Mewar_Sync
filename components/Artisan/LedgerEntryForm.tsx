import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Mic, Package, Sparkles } from 'lucide-react';
import type { EntryCategory, EntryType, InventoryItem, LedgerEntry, PaymentStatus } from '../../types';
import { InsufficientStockError, storage, type LedgerCollection } from '../../services/storage';
import { errorMessage } from '../../services/api';
import { BUSINESS_TYPES, ENTRY_TYPE_LABELS, PERSONAL_TYPES, categoryForType, validateLedgerDraft } from '../../lib/ledger';
import { findInventoryMatches, normalizeItemName, stockStatus } from '../../lib/inventory';
import { formatINR, roundMoney } from '../../lib/money';
import type { VoiceDraft } from '../../lib/voice';
import { cx } from '../../lib/cx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, FormErrorSummary, Input, MoneyInput, SegmentedControl, Select } from '../ui/Form';
import { Badge } from '../ui/Surface';

const TYPE_HELP: Record<EntryType, string> = {
  SALE: 'Money in from selling a piece. Stock goes down.',
  BUSINESS_EXPENSE: 'Buying or making stock. Stock goes up.',
  OTHER_EXPENSE: 'Wages, rent, bills — no stock change.',
  PERSONAL_RECEIVED: 'Money you received from a person.',
  PERSONAL_PAID: 'Money you gave to a person.',
};

interface LedgerEntryFormProps {
  open: boolean;
  onClose: () => void;
  /** Called with a short success message after a successful save. */
  onSaved: (message: string) => void;
  /** Existing entry to edit. */
  entry?: LedgerEntry;
  entryCollection?: LedgerCollection;
  /** Default category for a new entry. */
  defaultCategory?: EntryCategory;
  /** Pre-filled draft from the voice assistant (always reviewed before saving). */
  voiceDraft?: VoiceDraft;
}

function toInput(n: number | undefined): string {
  return n === undefined || !Number.isFinite(n) ? '' : String(roundMoney(n));
}

export function LedgerEntryForm({ open, onClose, onSaved, entry, entryCollection, defaultCategory = 'BUSINESS', voiceDraft }: LedgerEntryFormProps) {
  const isEdit = !!entry;
  const [category, setCategory] = useState<EntryCategory>(entry ? categoryForType(entry.type) : voiceDraft ? categoryForType(voiceDraft.type) : defaultCategory);
  const [type, setType] = useState<EntryType>(entry?.type ?? voiceDraft?.type ?? (defaultCategory === 'PERSONAL' ? 'PERSONAL_RECEIVED' : 'SALE'));
  const [item, setItem] = useState(entry?.item ?? voiceDraft?.item ?? '');
  const [quantity, setQuantity] = useState(entry ? String(entry.quantity) : voiceDraft?.quantity || '1');
  const [unitPrice, setUnitPrice] = useState(entry ? toInput(entry.unit_price) : voiceDraft?.unitPrice ?? '');
  const [amount, setAmount] = useState(entry ? toInput(entry.amount) : voiceDraft?.amount ?? '');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(entry?.payment_status ?? voiceDraft?.paymentStatus ?? 'PAID');
  const [customerName, setCustomerName] = useState(entry?.customer_name ?? voiceDraft?.customerName ?? '');
  const [isPurchased, setIsPurchased] = useState(voiceDraft?.isPurchased ?? true);
  const [inventoryId, setInventoryId] = useState<string | null>(entry?.inventory_id ?? null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // One id per form session makes the save idempotent across double taps and retries.
  const idempotencyKey = useRef(storage.newEntryId());

  useEffect(() => {
    if (!open) return;
    storage.getInventory().then(setInventory).catch(() => setInventory([]));
  }, [open]);

  const isBusiness = category === 'BUSINESS';
  const affectsStock = type === 'SALE' || type === 'BUSINESS_EXPENSE';

  const total = useMemo(() => {
    if (!isBusiness) return Number(amount) || 0;
    const q = Number(quantity);
    const u = Number(unitPrice);
    return Number.isFinite(q) && Number.isFinite(u) ? roundMoney(q * u) : 0;
  }, [isBusiness, quantity, unitPrice, amount]);

  const suggestions = useMemo(() => {
    const term = normalizeItemName(item);
    if (!isBusiness || term.length < 2) return [];
    return inventory.filter(i => (i.normalized_name || normalizeItemName(i.item)).includes(term)).slice(0, 6);
  }, [inventory, item, isBusiness]);

  const stockSources = useMemo(() => (type === 'SALE' ? findInventoryMatches(inventory, item) : []), [inventory, item, type]);
  const selectedSource = stockSources.find(s => s.id === inventoryId) ?? [...stockSources].sort((a, b) => b.quantity - a.quantity)[0];

  const changeCategory = (c: EntryCategory) => {
    setCategory(c);
    setType(c === 'BUSINESS' ? 'SALE' : 'PERSONAL_RECEIVED');
    setErrors({});
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setFormError('');
    const result = validateLedgerDraft({
      type,
      item,
      quantity,
      unitPrice,
      amount,
      paymentStatus,
      customerName,
      inventoryId: type === 'SALE' ? selectedSource?.id ?? inventoryId : inventoryId,
    });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});

    if (type === 'SALE' && !isEdit) {
      const available = selectedSource?.quantity ?? 0;
      if (available < result.value.quantity) {
        setErrors({ quantity: available > 0 ? `Only ${available} in stock.` : `“${result.value.item}” is not in your inventory yet.` });
        return;
      }
    }

    setSaving(true);
    try {
      if (isEdit && entry) {
        await storage.updateLedgerEntry(entryCollection ?? (entry.payment_status === 'PENDING' ? 'udhaar_entries' : 'ledger_entries'), entry.id, result.value);
        onSaved('Entry updated');
      } else {
        const { created } = await storage.createLedgerEntry(result.value, { id: idempotencyKey.current, isPurchased });
        if (voiceDraft) {
          void storage.logAIInteraction('VOICE_LEDGER', voiceDraft.transcript, { confirmed: true, type: result.value.type, amount: result.value.amount });
        }
        onSaved(created
          ? `${ENTRY_TYPE_LABELS[result.value.type]} of ${formatINR(result.value.amount)} recorded${result.value.payment_status === 'PENDING' ? ' as udhaar' : ''}`
          : 'This entry was already saved');
      }
    } catch (err) {
      if (err instanceof InsufficientStockError) setErrors({ quantity: err.message });
      else setFormError(errorMessage(err, 'Could not save the entry. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const types = isBusiness ? BUSINESS_TYPES : PERSONAL_TYPES;

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!saving}
      size="md"
      title={isEdit ? 'Edit entry' : voiceDraft ? 'Check your spoken entry' : 'New entry'}
      description={voiceDraft ? 'Nothing is saved until you confirm.' : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>{voiceDraft ? 'Discard' : 'Cancel'}</Button>
          <Button type="submit" form="ledger-entry-form" loading={saving}>
            {isEdit ? 'Save changes' : voiceDraft ? 'Confirm & save' : 'Save entry'}
          </Button>
        </>
      }
    >
      <form id="ledger-entry-form" onSubmit={submit} noValidate className="space-y-5">
        {voiceDraft && (
          <div className="rounded-md border border-gold/30 bg-gold-soft/60 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold-deep">
              <Mic aria-hidden className="size-3.5" /> You said
            </p>
            <p className="mt-1 text-[15px] italic text-ink">“{voiceDraft.transcript || '—'}”</p>
            {voiceDraft.warnings.length > 0 && (
              <ul className="mt-2 space-y-1">
                {voiceDraft.warnings.map(w => (
                  <li key={w} className="flex items-start gap-1.5 text-sm text-warning">
                    <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" /> {w}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 flex items-center gap-1 text-xs text-ink-muted"><Sparkles aria-hidden className="size-3" /> Fields below were suggested by AI.</p>
          </div>
        )}

        {formError && <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger">{formError}</div>}
        {Object.keys(errors).length > 1 && <FormErrorSummary errors={errors} />}

        {!isEdit && (
          <SegmentedControl
            label="Ledger"
            value={category}
            onChange={changeCategory}
            options={[{ value: 'BUSINESS', label: 'Business' }, { value: 'PERSONAL', label: 'Personal' }]}
            className="w-full"
          />
        )}

        <Field label="Entry type" required hint={TYPE_HELP[type]} error={errors.type}>
          <Select value={type} onChange={e => setType(e.target.value as EntryType)} disabled={isEdit}>
            {types.map(t => <option key={t} value={t}>{ENTRY_TYPE_LABELS[t]}</option>)}
          </Select>
        </Field>

        <div className="relative">
          <Field label={isBusiness ? 'Item or description' : 'Person'} required error={errors.item}>
            <Input
              value={item}
              maxLength={120}
              autoComplete="off"
              placeholder={isBusiness ? (type === 'OTHER_EXPENSE' ? 'e.g. Labour wages' : 'e.g. Pichwai painting') : 'e.g. Rajesh'}
              onChange={e => {
                setItem(e.target.value);
                setInventoryId(null);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => window.setTimeout(() => setShowSuggestions(false), 150)}
            />
          </Field>
          {showSuggestions && suggestions.length > 0 && type !== 'OTHER_EXPENSE' && (
            <ul aria-label="Matching stock items" className="ms-glass-strong absolute z-20 mt-1 w-full overflow-hidden rounded-lg">
              {suggestions.map(s => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-parchment-soft"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      setItem(s.item);
                      setInventoryId(s.id);
                      setIsPurchased(s.is_purchased);
                      if (!unitPrice && type === 'BUSINESS_EXPENSE') setUnitPrice(toInput(s.unit_cost));
                      setShowSuggestions(false);
                    }}
                  >
                    <span className="min-w-0 truncate font-medium">{s.item}</span>
                    <span className="ms-num shrink-0 text-xs text-ink-muted">
                      {s.quantity} in stock · {s.is_purchased ? 'bought' : 'made'} @ {formatINR(s.unit_cost)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {type === 'SALE' && stockSources.length > 1 && (
          <Field label="Take stock from" hint="You have this item from more than one source or cost.">
            <Select value={selectedSource?.id ?? ''} onChange={e => setInventoryId(e.target.value)} disabled={isEdit}>
              {stockSources.map(s => (
                <option key={s.id} value={s.id}>{s.item} — {s.is_purchased ? 'bought' : 'made'} @ {formatINR(s.unit_cost)} ({s.quantity} left)</option>
              ))}
            </Select>
          </Field>
        )}
        {type === 'SALE' && item.trim().length > 1 && !isEdit && (
          <p className="-mt-2 flex items-center gap-2 text-sm">
            <Package aria-hidden className="size-4 text-ink-muted" />
            {selectedSource ? (
              <>
                <span className="text-ink-muted">In stock:</span>
                <span className="ms-num font-semibold">{selectedSource.quantity}</span>
                {stockStatus(selectedSource.quantity) !== 'OK' && <Badge tone={selectedSource.quantity > 0 ? 'warning' : 'danger'}>{selectedSource.quantity > 0 ? 'Low' : 'Out of stock'}</Badge>}
              </>
            ) : (
              <span className="text-warning">Not found in inventory — add it in Inventory before selling.</span>
            )}
          </p>
        )}

        {type === 'BUSINESS_EXPENSE' && !isEdit && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink-soft">Stock source</legend>
            <SegmentedControl
              label="Stock source"
              value={isPurchased ? 'P' : 'S'}
              onChange={v => setIsPurchased(v === 'P')}
              options={[{ value: 'P', label: 'Purchased' }, { value: 'S', label: 'Made in workshop' }]}
              className="w-full"
            />
          </fieldset>
        )}

        {isBusiness ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity" required error={errors.quantity}>
              <Input type="text" inputMode="numeric" value={quantity} onChange={e => setQuantity(e.target.value.replace(/[^\d]/g, '').slice(0, 7))} className="ms-num" />
            </Field>
            <Field label={type === 'SALE' ? 'Rate per piece' : 'Cost per unit'} required error={errors.unitPrice}>
              <MoneyInput value={unitPrice} onChange={e => setUnitPrice(e.target.value)} />
            </Field>
          </div>
        ) : (
          <Field label="Amount" required error={errors.amount}>
            <MoneyInput value={amount} onChange={e => setAmount(e.target.value)} />
          </Field>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Payment">
            <Select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as PaymentStatus)} disabled={isEdit}>
              <option value="PAID">Paid now (nagad)</option>
              <option value="PENDING">Udhaar — pay later</option>
            </Select>
          </Field>
          <Field label={type === 'SALE' ? 'Customer' : isBusiness ? 'Supplier / payee' : 'Note'} required={paymentStatus === 'PENDING' && isBusiness} error={errors.customerName}>
            <Input value={customerName} maxLength={80} onChange={e => setCustomerName(e.target.value)} placeholder="Optional" autoComplete="off" />
          </Field>
        </div>

        <div className={cx('flex items-center justify-between rounded-md border px-4 py-3', type === 'SALE' || type === 'PERSONAL_RECEIVED' ? 'border-success/25 bg-success-soft/60' : 'border-maroon/20 bg-maroon-soft/60')}>
          <span className="text-sm font-medium text-ink-soft">{type === 'SALE' || type === 'PERSONAL_RECEIVED' ? 'Money in' : 'Money out'}</span>
          <span className="ms-num font-display text-2xl font-semibold">{formatINR(total)}</span>
        </div>
      </form>
    </Modal>
  );
}
