'use client';

import { useState } from 'react';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { RECORD_STATUS_OPTIONS } from '@/lib/constants';
import { formatDate, formatNumber } from '@/lib/format';
import usePaginatedList from '@/hooks/usePaginatedList';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Field from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import SearchInput from '@/components/ui/SearchInput';
import Select from '@/components/ui/Select';
import SortableTh, { TH_CLASS } from '@/components/ui/SortableTh';
import TableSkeleton from '@/components/ui/TableSkeleton';
import Textarea from '@/components/ui/Textarea';

const DARK_BUTTON =
  'inline-flex h-11 items-center gap-2 rounded-full bg-[#1c1c20] px-5 text-sm font-medium text-white transition-colors hover:bg-black';
const ICON_BUTTON = 'rounded-full p-2 text-slate-500 transition-colors hover:bg-[#ece9f8] hover:text-[#6b5fb0]';

function EntityFormModal({ entity, singular, endpoint, onClose, onSaved }) {
  const isEdit = Boolean(entity?.id);
  const [form, setForm] = useState({
    name: entity?.name || '',
    description: entity?.description || '',
    status: entity?.status || 'ACTIVE',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setFieldErrors({});

    if (form.name.trim().length < 2) {
      setFieldErrors({ name: 'Name must be at least 2 characters' });
      return;
    }

    setSaving(true);
    try {
      const body = { name: form.name.trim(), description: form.description.trim(), status: form.status };
      const res = isEdit ? await api.patch(`${endpoint}/${entity.id}`, body) : await api.post(endpoint, body);
      toast.success(res.message);
      onSaved();
    } catch (err) {
      setError(err.message);
      setFieldErrors(Object.fromEntries((err.errors || []).map((e) => [e.field, e.message])));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      title={isEdit ? `Edit ${singular.toLowerCase()}` : `New ${singular.toLowerCase()}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="entity-form" icon={Save} loading={saving}>
            {isEdit ? 'Save changes' : `Create ${singular.toLowerCase()}`}
          </Button>
        </>
      }
    >
      <form id="entity-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}
        <Field label="Name" value={form.name} onChange={update('name')} error={fieldErrors.name} autoFocus />
        <Textarea
          label="Description (optional)"
          value={form.description}
          onChange={update('description')}
          error={fieldErrors.description}
        />
        <Select label="Status" options={RECORD_STATUS_OPTIONS} value={form.status} onChange={update('status')} />
      </form>
    </Modal>
  );
}

/**
 * One page component for both Categories and Brands.
 * permissions = { create, update, delete } (permission strings, used to show/hide buttons)
 */
export default function NamedEntityPage({ title, singular, description, endpoint, emptyIcon, permissions }) {
  const { can } = useAuth();
  const list = usePaginatedList(endpoint, { initialParams: { sortBy: 'name', sortOrder: 'asc' } });
  const [editing, setEditing] = useState(null); // null = closed, {} = new, entity = edit
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const { items, pagination, loading, error, params } = list;
  const canCreate = can(permissions.create);
  const canUpdate = can(permissions.update);
  const canDelete = can(permissions.delete);
  const showActions = canUpdate || canDelete;
  const columnCount = showActions ? 6 : 5;
  const total = pagination?.totalItems;

  const confirmDelete = async () => {
    setDeleteBusy(true);
    setDeleteError('');
    try {
      const res = await api.delete(`${endpoint}/${deleting.id}`);
      toast.success(res.message);
      setDeleting(null);
      list.reload();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const sortProps = { sortBy: params.sortBy, sortOrder: params.sortOrder, onSort: list.setSort };

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {description}
            {total !== undefined && total !== null && (
              <span className="ml-2 rounded-full bg-[#ece9f8] px-2.5 py-0.5 text-xs font-medium text-[#6b5fb0]">
                {formatNumber(total)} total
              </span>
            )}
          </p>
        </div>
        {canCreate && (
          <button type="button" onClick={() => setEditing({})} className={DARK_BUTTON}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New {singular.toLowerCase()}
          </button>
        )}
      </header>

      <section className="mb-4 rounded-3xl bg-white p-4 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchInput
            value={list.searchInput}
            onChange={list.setSearchInput}
            placeholder={`Search ${title.toLowerCase()}...`}
            className="sm:w-80"
          />
          <Select
            aria-label="Filter by status"
            placeholder="All statuses"
            options={RECORD_STATUS_OPTIONS}
            value={params.status || ''}
            onChange={(event) => list.setFilter('status', event.target.value)}
            className="sm:w-48"
          />
        </div>
      </section>

      <div className="overflow-hidden rounded-3xl bg-white shadow-card">
        {error ? (
          <ErrorState message={error} onRetry={list.reload} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-[#f6f4fc]">
                <tr>
                  <SortableTh label="Name" field="name" {...sortProps} />
                  <th scope="col" className={TH_CLASS}>
                    Description
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Products
                  </th>
                  <SortableTh label="Status" field="status" {...sortProps} />
                  <SortableTh label="Created" field="createdAt" {...sortProps} />
                  {showActions && (
                    <th scope="col" className={`${TH_CLASS} text-right`}>
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              {loading && items.length === 0 ? (
                <TableSkeleton rows={6} cols={columnCount} />
              ) : (
                <tbody className={loading ? 'opacity-60 transition-opacity' : ''}>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-black/5 transition-colors hover:bg-[#faf9fe]">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ece9f8] text-xs font-bold text-[#6b5fb0]">
                            {item.name.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="font-semibold text-ink">{item.name}</span>
                        </div>
                      </td>
                      <td className="max-w-xs truncate px-4 py-3.5 text-slate-600">{item.description || '—'}</td>
                      <td className="px-4 py-3.5 text-slate-700">{item.productCount}</td>
                      <td className="px-4 py-3.5">
                        <Badge tone={item.status === 'ACTIVE' ? 'success' : 'neutral'}>
                          {item.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">{formatDate(item.createdAt)}</td>
                      {showActions && (
                        <td className="px-4 py-3.5">
                          <div className="flex justify-end gap-1">
                            {canUpdate && (
                              <button
                                type="button"
                                onClick={() => setEditing(item)}
                                className={ICON_BUTTON}
                                aria-label={`Edit ${item.name}`}
                              >
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteError('');
                                  setDeleting(item);
                                }}
                                className="rounded-full p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                                aria-label={`Delete ${item.name}`}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              )}
            </table>

            {!loading && items.length === 0 && (
              <EmptyState
                icon={emptyIcon}
                title={`No ${title.toLowerCase()} found`}
                description={
                  params.search || params.status
                    ? 'Try a different search or clear the filters.'
                    : `Create your first ${singular.toLowerCase()} to get started.`
                }
                action={
                  canCreate &&
                  !params.search &&
                  !params.status && (
                    <button type="button" onClick={() => setEditing({})} className={DARK_BUTTON}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      New {singular.toLowerCase()}
                    </button>
                  )
                }
              />
            )}
          </div>
        )}
      </div>

      <Pagination pagination={pagination} onPageChange={list.setPage} />

      {editing && (
        <EntityFormModal
          key={editing.id || 'new'}
          entity={editing}
          singular={singular}
          endpoint={endpoint}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.reload();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={`Delete ${singular.toLowerCase()}?`}
        message={`"${deleting?.name}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteBusy}
        error={deleteError}
      />
    </div>
  );
}