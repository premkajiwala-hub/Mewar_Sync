import React, { useState } from 'react';
import { MAX_AMOUNT } from '../../lib/money';
import { Field, Input, MoneyInput, Textarea } from '../ui/Form';

export interface ProductDraft {
  title: string;
  description: string;
  price: string;
  style: string;
}

export interface ValidProduct {
  title: string;
  description: string;
  price: number;
  style: string;
}

export function validateProductDraft(d: ProductDraft): { ok: true; value: ValidProduct } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const title = d.title.replace(/\s+/g, ' ').trim();
  const description = d.description.trim();
  const style = d.style.replace(/\s+/g, ' ').trim();
  const priceText = d.price.replace(/[,\s₹]/g, '');
  if (!title) errors.title = 'Give the piece a title.';
  else if (title.length > 140) errors.title = 'Keep the title under 140 characters.';
  if (description.length > 5000) errors.description = 'Keep the story under 5,000 characters.';
  if (style.length > 80) errors.style = 'Keep the style under 80 characters.';
  let price = 0;
  if (!/^\d+(\.\d{1,2})?$/.test(priceText)) errors.price = 'Enter a price in rupees, e.g. 4500.';
  else if (Number(priceText) <= 0) errors.price = 'Price must be greater than zero.';
  else if (Number(priceText) > MAX_AMOUNT) errors.price = 'Price is too large.';
  else price = Number(priceText);
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { title, description, price, style: style || 'Handicraft' } };
}

/** Title / story / price / style fields shared by Scan-to-List and the gallery editor. */
export function ProductFields({ draft, onChange, errors, aiSuggested }: { draft: ProductDraft; onChange: (d: ProductDraft) => void; errors: Record<string, string>; aiSuggested?: boolean }) {
  const [touched] = useState(aiSuggested);
  return (
    <div className="space-y-4">
      <Field label="Title" required error={errors.title} hint={touched ? 'Suggested by AI — edit freely.' : undefined}>
        <Input value={draft.title} maxLength={140} onChange={e => onChange({ ...draft, title: e.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Price" required error={errors.price} hint={aiSuggested ? 'AI estimate only — set your own price.' : undefined}>
          <MoneyInput value={draft.price} onChange={e => onChange({ ...draft, price: e.target.value })} />
        </Field>
        <Field label="Style or craft" error={errors.style}>
          <Input value={draft.style} maxLength={80} onChange={e => onChange({ ...draft, style: e.target.value })} placeholder="e.g. Pichwai" />
        </Field>
      </div>
      <Field label="Story" error={errors.description} hint={`${draft.description.length.toLocaleString('en-IN')} / 5,000 characters`}>
        <Textarea rows={7} value={draft.description} maxLength={5000} onChange={e => onChange({ ...draft, description: e.target.value })} />
      </Field>
    </div>
  );
}
