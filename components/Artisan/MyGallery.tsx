import React, { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Camera, Heart, Image as ImageIcon, Pencil, Trash2 } from 'lucide-react';
import type { ArtisanProduct } from '../../types';
import { storage } from '../../services/storage';
import { errorMessage } from '../../services/api';
import { useApp } from '../layout/AppContext';
import { PageContainer } from '../layout/AppShell';
import { Button, IconButton } from '../ui/Button';
import { ConfirmDialog, Modal } from '../ui/Modal';
import { Badge, Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from '../ui/Surface';
import { ArchImage } from '../ui/Ornaments';
import { useToast } from '../ui/Toast';
import { ProductFields, validateProductDraft, type ProductDraft } from './ProductEditor';
import { formatINR } from '../../lib/money';
import { safeImageUrl } from '../../lib/text';

export const MyGallery: React.FC = () => {
  const { user, navigate, dataVersion } = useApp();
  const toast = useToast();
  const [products, setProducts] = useState<ArtisanProduct[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ArtisanProduct | null>(null);
  const [draft, setDraft] = useState<ProductDraft>({ title: '', description: '', price: '', style: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<ArtisanProduct | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setProducts(await storage.getProductsByShop(user.id));
      setStatus('ready');
    } catch (err) {
      setError(errorMessage(err, 'Could not load your gallery.'));
      setStatus('error');
    }
  }, [user.id]);

  useEffect(() => {
    void load();
  }, [load, dataVersion]);

  const startEdit = (p: ArtisanProduct) => {
    setEditing(p);
    setErrors({});
    setDraft({ title: p.title, description: p.description || '', price: String(p.price ?? ''), style: p.style || '' });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const r = validateProductDraft(draft);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setBusy(true);
    try {
      await storage.updateProduct(editing.id, r.value);
      setProducts(list => list.map(p => (p.id === editing.id ? { ...p, ...r.value } : p)));
      toast.success('Piece updated');
      setEditing(null);
    } catch (err) {
      toast.error('Could not save', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await storage.deleteProduct(deleting.id);
      setProducts(list => list.filter(p => p.id !== deleting.id));
      toast.success(`“${deleting.title}” removed from your gallery`);
      setDeleting(null);
    } catch (err) {
      toast.error('Could not remove', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer wide>
      <PageHeader
        title="My gallery"
        actions={<Button icon={Camera} onClick={() => navigate('/scan')}>List a new piece</Button>}
      />

      {status === 'loading' && <Card><LoadingBlock label="Loading your gallery" /></Card>}
      {status === 'error' && <Card><ErrorState message={error} onRetry={load} /></Card>}
      {status === 'ready' && products.length === 0 && (
        <Card>
          <EmptyState icon={ImageIcon} title="Your gallery is empty"  action={<Button icon={Camera} onClick={() => navigate('/scan')}>Scan to list</Button>} />
        </Card>
      )}

      {status === 'ready' && products.length > 0 && (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map(p => (
            <li key={p.id}>
              <Card as="article" interactive className="group flex h-full flex-col overflow-hidden">
                <div className="px-4 pt-4">
                  <ArchImage src={safeImageUrl(p.image_url)} alt={p.title} className="aspect-[4/5] w-full" />
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {p.style && <Badge tone="gold">{p.style}</Badge>}
                    {p.is_verified && <Badge tone="success" icon={BadgeCheck}>Verified</Badge>}
                  </div>
                  <h2 className="line-clamp-2 text-lg font-semibold leading-snug">{p.title}</h2>
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <span className="ms-num font-display text-xl font-semibold">{formatINR(p.price)}</span>
                    <span className="inline-flex items-center gap-1 text-sm text-ink-muted"><Heart aria-hidden className="size-4" /> {p.likes?.length ?? 0}<span className="sr-only"> likes</span></span>
                  </div>
                  <div className="mt-3 flex gap-1 border-t border-line-soft pt-3">
                    <Button variant="secondary" size="sm" icon={Pencil} className="flex-1" onClick={() => startEdit(p)}>Edit</Button>
                    <IconButton icon={Trash2} size="sm" tone="danger" label={`Remove ${p.title}`} onClick={() => setDeleting(p)} />
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        dismissible={!busy}
        size="lg"
        title="Edit piece"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
            <Button type="submit" form="product-edit-form" loading={busy}>Save changes</Button>
          </>
        }
      >
        {editing && (
          <form id="product-edit-form" onSubmit={save} noValidate className="grid gap-5 md:grid-cols-[200px_1fr]">
            <ArchImage src={safeImageUrl(editing.image_url)} alt={editing.title} className="aspect-[4/5] w-full max-w-[200px]" />
            <ProductFields draft={draft} onChange={setDraft} errors={errors} />
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        tone="danger"
        title="Remove this piece?"
        confirmLabel="Remove"
        loading={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={remove}
        message={deleting && <>“{deleting.title}” will no longer appear on your profile. This cannot be undone.</>}
      />
    </PageContainer>
  );
};
