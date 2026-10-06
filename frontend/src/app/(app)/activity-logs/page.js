'use client';

import { ScrollText } from 'lucide-react';
import { ACTIVITY_ENTITY_OPTIONS, DATE_RANGE_OPTIONS, ROLE_LABELS } from '@/lib/constants';
import { formatDateTime, formatNumber } from '@/lib/format';
import usePaginatedList from '@/hooks/usePaginatedList';
import RequirePermission from '@/components/auth/RequirePermission';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Pagination from '@/components/ui/Pagination';
import SearchInput from '@/components/ui/SearchInput';
import Select from '@/components/ui/Select';
import SortableTh, { TH_CLASS } from '@/components/ui/SortableTh';
import TableSkeleton from '@/components/ui/TableSkeleton';

// "Custom range" needs two date inputs, so it is left out of this first version
const RANGE_OPTIONS = DATE_RANGE_OPTIONS.filter((option) => option.value !== 'custom');

const ENTITY_LABELS = Object.fromEntries(ACTIVITY_ENTITY_OPTIONS.map((option) => [option.value, option.label]));

const prettyAction = (action) =>
  action
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^./, (char) => char.toUpperCase());

const actionTone = (action) => {
  if (/DELET|REMOV/.test(action)) return 'danger';
  if (/FAIL|CANCEL|DISABLE|DEACTIV/.test(action)) return 'warning';
  if (/CREAT|COMPLET|RECEIV|LOGIN/.test(action)) return 'success';
  return 'info';
};

function ActivityLogList() {
  const list = usePaginatedList('/activities', {
    initialParams: { sortBy: 'createdAt', sortOrder: 'desc', limit: 20 },
  });
  const { items, pagination, loading, error, params } = list;
  const total = pagination?.totalItems;
  const hasFilters = Boolean(params.search || params.entity || params.range);
  const sortProps = { sortBy: params.sortBy, sortOrder: params.sortOrder, onSort: list.setSort };

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Activity logs</h1>
        <p className="mt-1 text-sm text-slate-500">
          Who did what in the system.
          {total !== undefined && total !== null && (
            <span className="ml-2 rounded-full bg-[#ece9f8] px-2.5 py-0.5 text-xs font-medium text-[#6b5fb0]">
              {formatNumber(total)} total
            </span>
          )}
        </p>
      </header>

      <section className="mb-4 rounded-3xl bg-white p-4 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap">
          <SearchInput
            value={list.searchInput}
            onChange={list.setSearchInput}
            placeholder="Search the description..."
            className="lg:w-80"
          />
          <Select
            aria-label="Filter by area"
            placeholder="All areas"
            options={ACTIVITY_ENTITY_OPTIONS}
            value={params.entity || ''}
            onChange={(e) => list.setFilter('entity', e.target.value)}
            className="lg:w-48"
          />
          <Select
            aria-label="Filter by date"
            placeholder="Any date"
            options={RANGE_OPTIONS}
            value={params.range || ''}
            onChange={(e) => list.setFilter('range', e.target.value)}
            className="lg:w-44"
          />
        </div>
      </section>

      <div className="overflow-hidden rounded-3xl bg-white shadow-card">
        {error ? (
          <ErrorState message={error} onRetry={list.reload} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-[#f6f4fc]">
                <tr>
                  <SortableTh label="Time" field="createdAt" {...sortProps} />
                  <th scope="col" className={TH_CLASS}>
                    User
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Action
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Area
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Description
                  </th>
                </tr>
              </thead>

              {loading && items.length === 0 ? (
                <TableSkeleton rows={10} cols={5} />
              ) : (
                <tbody className={loading ? 'opacity-60 transition-opacity' : ''}>
                  {items.map((activity) => (
                    <tr key={activity.id} className="border-t border-black/5 align-top transition-colors hover:bg-[#faf9fe]">
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">{formatDateTime(activity.createdAt)}</td>
                      <td className="px-4 py-3.5">
                        {activity.user ? (
                          <>
                            <p className="font-semibold text-ink">{activity.user.name}</p>
                            <p className="text-xs text-slate-500">
                              {ROLE_LABELS[activity.user.role] || activity.user.role}
                            </p>
                          </>
                        ) : (
                          <span className="text-slate-400">System</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge tone={actionTone(activity.action)}>{prettyAction(activity.action)}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-700">
                        {ENTITY_LABELS[activity.entity] || activity.entity}
                      </td>
                      <td className="max-w-md px-4 py-3.5 text-slate-700">{activity.description}</td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>

            {!loading && items.length === 0 && (
              <EmptyState
                icon={ScrollText}
                title="No activity found"
                description={hasFilters ? 'Try a different search or clear the filters.' : 'Actions will be recorded here.'}
              />
            )}
          </div>
        )}
      </div>

      <Pagination pagination={pagination} onPageChange={list.setPage} />
    </div>
  );
}

export default function ActivityLogsPage() {
  return (
    <RequirePermission permission="activities:view">
      <ActivityLogList />
    </RequirePermission>
  );
}