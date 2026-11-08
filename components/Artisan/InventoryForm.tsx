import React, { useState } from 'react';
import { Mic } from 'lucide-react';
import type { InventoryItem } from '../../types';
import { storage } from '../../services/storage';
import { errorMessage } from '../../services/api';
import { validateInventoryDraft } from '../../lib/inventory';
import { roundMoney } from '../../lib/money';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, FormErrorSummary, Input, MoneyInput, SegmentedControl } from '../ui/Form';

interface InventoryFormProps {
  open: boolean;
  item?: InventoryItem;
  prefill?: { item: string; quantity: string; unitCost: string; isPurchased: boolean; transcript?: string };
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function InventoryForm({ open, item, prefill, onClose, onSaved }: InventoryFormProps) {
  const [name, setName] = useState(item?.item ?? prefill?.item ?? '');
  const [quantity, setQuantity] = useState(item ? String(item.quantity) : prefill?.quantity ?? '');
  const [unitCost, setUnitCost] = useState(item ? String(roundMoney(item.unit_cost)) : prefill?.unitCost ?? '');
  const [isPurchased, setIsPurchased] = useState(item?.is_purchased ?? prefill?.isPurchased ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const r = validateInventoryDraft({ item: name, quantity, unitCost, isPurchased });
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setErrors({});
    setFormError('');
    setSaving(true);
    try {
      if (item) {
        await storage.updateInventoryItem(item.id, r.value);
        onSaved(`“${r.value.item}” updated`);
      } else {
        await storage.addInventoryItem(r.value);
        onSaved(`${r.value.quantity} × “${r.value.item}” added to stock`);
      }
    } catch (err) {
      setFormError(errorMessage(err, 'Could not save the stock item.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title={item ? 'Edit stock item' : prefill ? 'Check your spoken stock entry' : 'Add stock'}
      description={item ? undefined : 'Matching items are combined automatically.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="inventory-form" loading={saving}>{item ? 'Save changes' : 'Add to stock'}</Button>
        </>
      }
    >
      <form id="inventory-form" onSubmit={submit} noValidate className="space-y-5">
        {prefill?.transcript && (
          <div className="rounded-md border border-gold/30 bg-gold-soft/60 p-3 text-sm">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold-deep"><Mic aria-hidden className="size-3.5" /> You said</p>
            <p className="mt-1 italic">“{prefill.transcript}”</p>
          </div>
        )}
        {formError && <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger">{formError}</div>}
        {Object.keys(errors).length > 1 && <FormErrorSummary errors={errors} />}
        <Field label="Item name" required error={errors.item}>
          <Input value={name} onChange={e => setName(e.target.value)} maxLength={120} placeholder="e.g. Natural indigo pigment" />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink-soft">Source</legend>
          <SegmentedControl label="Source" value={isPurchased ? 'P' : 'S'} onChange={v => setIsPurchased(v === 'P')} options={[{ value: 'P', label: 'Purchased' }, { value: 'S', label: 'Made in workshop' }]} className="w-full" />
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Field label={item ? 'Quantity in stock' : 'Quantity to add'} required error={errors.quantity}>
            <Input inputMode="numeric" value={quantity} onChange={e => setQuantity(e.target.value.replace(/[^\d]/g, '').slice(0, 7))} className="ms-num" />
          </Field>
          <Field label="Unit cost" required hint="Use 0 if unknown." error={errors.unitCost}>
            <MoneyInput value={unitCost} onChange={e => setUnitCost(e.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
