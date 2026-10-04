'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Minus, Package, Plus, ShoppingCart, Trash2, User, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from '@/lib/constants';
import { formatMoney, formatNumber } from '@/lib/format';
import usePaginatedList from '@/hooks/usePaginatedList';
import useClickOutside from '@/hooks/useClickOutside';
import useDebounce from '@/hooks/useDebounce';
import RequirePermission from '@/components/auth/RequirePermission';
import StockBadge from '@/components/catalog/StockBadge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Field from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import SearchInput from '@/components/ui/SearchInput';
import Select from '@/components/ui/Select';

const DISCOUNT_TYPE_OPTIONS = [
  { value: 'FIXED', label: 'Fixed amount' },
  { value: 'PERCENT', label: 'Percent (%)' },
];

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function Thumbnail({ src, name }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#ece9f8]">
        <Package className="h-6 w-6 text-[#8b7fc7]" aria-hidden="true" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      className="h-14 w-14 shrink-0 rounded-2xl bg-[#ece9f8] object-cover"
    />
  );
}

function ProductTile({ product, inCartQty, onAdd }) {
  const out = product.currentStock <= 0;

  return (
    <button
      type="button"
      onClick={() => onAdd(product)}
      disabled={out}
      className="flex items-start gap-3 rounded-2xl border border-black/5 bg-white p-3 text-left transition-colors hover:bg-[#faf9fe] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Thumbnail src={product.image} name={product.name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{product.name}</span>
        <span className="block truncate text-xs text-slate-500">{product.sku}</span>
        <span className="mt-1 block text-sm font-bold text-ink">{formatMoney(product.sellingPrice)}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">
            {formatNumber(product.currentStock)} {product.unit}
          </span>
          <StockBadge status={product.stockStatus} />
          {inCartQty > 0 && (
            <span className="rounded-full bg-[#ece9f8] px-2 py-0.5 text-xs font-medium text-[#6b5fb0]">
              {inCartQty} in cart
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/** Search a customer by name, phone or email. Leaving it empty means a walk-in sale. */
function CustomerPicker({ customer, onChange }) {
  const [term, setTerm] = useState('');
  const debounced = useDebounce(term, 300);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  useEffect(() => {
    const query = debounced.trim();
    if (!query) {
      setResults([]);
      return undefined;
    }

    let active = true;
    setLoading(true);
    api
      .get('/customers', { search: query, limit: 6, sortBy: 'name', sortOrder: 'asc' })
      .then((res) => {
        if (!active) return;
        setResults(res.data);
        setOpen(true);
      })
      .catch(() => active && setResults([]))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [debounced]);

  const choose = (item) => {
    onChange(item);
    setTerm('');
    setResults([]);
    setOpen(false);
  };

  if (customer) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl bg-[#f6f4fc] px-3 py-2.5">
        <span className="flex min-w-0 items-center gap-2">
          <User className="h-4 w-4 shrink-0 text-[#6b5fb0]" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">{customer.name}</span>
            {customer.phone && <span className="block text-xs text-slate-500">{customer.phone}</span>}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded-full p-1.5 text-slate-500 hover:bg-black/5"
          aria-label="Remove customer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <SearchInput value={term} onChange={setTerm} placeholder="Walk-in. Search a customer to attach..." />
      {loading && (
        <Loader2
          className="absolute right-11 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400"
          aria-hidden="true"
        />
      )}
      {open && term.trim() && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-black/5 bg-white p-2 shadow-pill">
          {results.length === 0 && !loading ? (
            <p className="px-3 py-4 text-center text-sm text-slate-500">No customers found.</p>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => choose(item)}
                className="block w-full rounded-xl px-3 py-2.5 text-left hover:bg-black/5"
              >
                <span className="block truncate text-sm font-semibold text-ink">{item.name}</span>
                <span className="block text-xs text-slate-500">{item.phone || item.email || '—'}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ReceiptModal({ sale, onClose }) {
  return (
    <Modal
      open
      onClose={onClose}
      title="Sale completed"
      footer={<Button onClick={onClose}>New sale</Button>}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl bg-green-50 px-4 py-3">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-ink">Invoice {sale.invoiceNumber}</p>
            <p className="text-xs text-slate-600">
              {sale.customer ? sale.customer.name : 'Walk-in customer'} ·{' '}
              {PAYMENT_METHOD_LABELS[sale.paymentMethod] || sale.paymentMethod}
            </p>
          </div>
        </div>

        <ul className="divide-y divide-black/5 text-sm">
          {sale.items.map((item) => (
            <li key={`${item.product}-${item.sku}`} className="flex items-start justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">{item.name}</span>
                <span className="block text-xs text-slate-500">
                  {formatNumber(item.quantity)} × {formatMoney(item.unitPrice)}
                </span>
              </span>
              <span className="whitespace-nowrap font-semibold text-ink">{formatMoney(item.lineTotal)}</span>
            </li>
          ))}
        </ul>

        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-600">
            <dt>Subtotal</dt>
            <dd>{formatMoney(sale.subtotal)}</dd>
          </div>
          {sale.discount?.amount > 0 && (
            <div className="flex justify-between text-slate-600">
              <dt>Discount</dt>
              <dd>− {formatMoney(sale.discount.amount)}</dd>
            </div>
          )}
          {sale.taxAmount > 0 && (
            <div className="flex justify-between text-slate-600">
              <dt>Tax ({sale.taxRate}%)</dt>
              <dd>{formatMoney(sale.taxAmount)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-black/10 pt-2 text-base font-bold text-ink">
            <dt>Grand total</dt>
            <dd>{formatMoney(sale.grandTotal)}</dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}

function PosScreen() {
  const list = usePaginatedList('/products', {
    initialParams: { sortBy: 'name', sortOrder: 'asc', status: 'ACTIVE', limit: 12 },
  });
  const { items, pagination, loading, error, params } = list;

  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [discountType, setDiscountType] = useState('FIXED');
  const [discountValue, setDiscountValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [submitting, setSubmitting] = useState(false);
  const [saleError, setSaleError] = useState('');
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    let active = true;
    api
      .get('/categories/options')
      .then((res) => active && setCategories(res.data.map((c) => ({ value: c.id, label: c.name }))))
      .catch(() => {}); // the filter simply stays empty
    return () => {
      active = false;
    };
  }, []);

  const addToCart = (product) => {
    if (product.currentStock <= 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }
    const existing = cart.find((item) => item.productId === product.id);
    if (existing) {
      if (existing.quantity >= product.currentStock) {
        toast.error(`Only ${product.currentStock} ${product.unit} in stock`, { id: 'stock-limit' });
        return;
      }
      setCart((prev) =>
        prev.map((item) => (item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item))
      );
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        unitPrice: product.sellingPrice,
        stock: product.currentStock,
        quantity: 1,
      },
    ]);
  };

  const setQuantity = (productId, value) =>
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const wanted = Math.max(1, Math.floor(Number(value) || 1));
        if (wanted > item.stock) toast.error(`Only ${item.stock} ${item.unit} in stock`, { id: 'stock-limit' });
        return { ...item, quantity: Math.min(item.stock, wanted) };
      })
    );

  const removeItem = (productId) => setCart((prev) => prev.filter((item) => item.productId !== productId));

  // Barcode scanners type the code and press Enter: add the exact match (or the first result)
  const handleScan = async (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const term = list.searchInput.trim();
    if (!term) return;

    try {
      const res = await api.get('/products', {
        search: term,
        limit: 5,
        status: 'ACTIVE',
        sortBy: 'name',
        sortOrder: 'asc',
      });
      const product = res.data.find((p) => p.barcode === term || p.sku === term.toUpperCase()) || res.data[0];
      if (!product) {
        toast.error('No active product found');
        return;
      }
      addToCart(product);
      list.setSearchInput('');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const subtotal = round2(cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const discountNum = Number(discountValue) || 0;

  let discountError = '';
  if (discountValue !== '' && (!Number.isFinite(Number(discountValue)) || Number(discountValue) < 0)) {
    discountError = 'Enter a valid amount';
  } else if (discountType === 'PERCENT' && discountNum > 100) {
    discountError = 'Cannot be more than 100%';
  } else if (discountType === 'FIXED' && discountNum > subtotal) {
    discountError = 'Cannot be more than the subtotal';
  }

  const discountAmount = discountError
    ? 0
    : discountType === 'PERCENT'
      ? round2((subtotal * discountNum) / 100)
      : discountNum;
  const total = round2(subtotal - discountAmount);
  const unitCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const resetSale = () => {
    setCart([]);
    setCustomer(null);
    setDiscountType('FIXED');
    setDiscountValue('');
    setPaymentMethod('CASH');
    setSaleError('');
  };

  const checkout = async () => {
    setSaleError('');
    if (cart.length === 0) return;
    if (discountError) {
      setSaleError(discountError);
      return;
    }

    const payload = {
      items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      paymentMethod,
    };
    if (customer) payload.customerId = customer.id;
    if (discountNum > 0) payload.discount = { type: discountType, value: discountNum };

    setSubmitting(true);
    try {
      const res = await api.post('/sales', payload);
      toast.success(res.message);
      setReceipt(res.data);
      resetSale();
      list.reload(); // stock numbers on the tiles change after a sale
    } catch (err) {
      setSaleError(err.message);
      list.reload();
    } finally {
      setSubmitting(false);
    }
  };

  const cartQty = (productId) => cart.find((item) => item.productId === productId)?.quantity || 0;

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Point of Sale</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pick products or scan a barcode, then complete the sale.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---------- Products ---------- */}
        <div className="lg:col-span-2">
          <section className="mb-4 rounded-3xl bg-white p-4 shadow-card">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="sm:w-80" onKeyDown={handleScan}>
                <SearchInput
                  value={list.searchInput}
                  onChange={list.setSearchInput}
                  placeholder="Search or scan name, SKU, barcode..."
                />
              </div>
              <Select
                aria-label="Filter by category"
                placeholder="All categories"
                options={categories}
                value={params.category || ''}
                onChange={(e) => list.setFilter('category', e.target.value)}
                className="sm:w-52"
              />
            </div>
          </section>

          <div className="rounded-3xl bg-white p-4 shadow-card">
            {error ? (
              <ErrorState message={error} onRetry={list.reload} />
            ) : loading && items.length === 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No products found"
                description="Try a different search or clear the category filter."
              />
            ) : (
              <div
                className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${loading ? 'opacity-60 transition-opacity' : ''}`}
              >
                {items.map((product) => (
                  <ProductTile
                    key={product.id}
                    product={product}
                    inCartQty={cartQty(product.id)}
                    onAdd={addToCart}
                  />
                ))}
              </div>
            )}
          </div>

          <Pagination pagination={pagination} onPageChange={list.setPage} />
        </div>

        {/* ---------- Cart ---------- */}
        <aside>
          <section className="rounded-3xl bg-white p-5 shadow-card lg:sticky lg:top-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">
                Cart{unitCount > 0 && <span className="ml-2 text-sm font-medium text-slate-500">({unitCount})</span>}
              </h2>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={resetSale}
                  className="text-sm font-medium text-slate-500 hover:text-red-600"
                >
                  Clear
                </button>
              )}
            </div>

            <CustomerPicker customer={customer} onChange={setCustomer} />

            {cart.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="Cart is empty"
                description="Tap a product to add it."
              />
            ) : (
              <ul className="mt-4 max-h-[40vh] divide-y divide-black/5 overflow-y-auto">
                {cart.map((item) => (
                  <li key={item.productId} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{item.name}</p>
                        <p className="text-xs text-slate-500">
                          {formatMoney(item.unitPrice)} · {item.stock} {item.unit} in stock
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        className="rounded-full p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            item.quantity <= 1 ? removeItem(item.productId) : setQuantity(item.productId, item.quantity - 1)
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ece9f8] text-[#6b5fb0] hover:bg-[#e0dcf3]"
                          aria-label={`Decrease ${item.name}`}
                        >
                          <Minus className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={item.stock}
                          step="1"
                          inputMode="numeric"
                          value={item.quantity}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setQuantity(item.productId, e.target.value)}
                          aria-label={`Quantity of ${item.name}`}
                          className="h-8 w-14 rounded-lg border border-slate-300 text-center text-sm font-semibold text-ink focus:border-ink focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setQuantity(item.productId, item.quantity + 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ece9f8] text-[#6b5fb0] hover:bg-[#e0dcf3]"
                          aria-label={`Increase ${item.name}`}
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-ink">
                        {formatMoney(round2(item.quantity * item.unitPrice))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {cart.length > 0 && (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-black/10 pt-4">
                  <Select
                    label="Discount"
                    options={DISCOUNT_TYPE_OPTIONS}
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                  />
                  <Field
                    label="Value"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    error={discountError}
                  />
                </div>

                <Select
                  className="mt-3"
                  label="Payment method"
                  options={PAYMENT_METHOD_OPTIONS}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                />

                <dl className="mt-4 space-y-1.5 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <dt>Subtotal</dt>
                    <dd>{formatMoney(subtotal)}</dd>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <dt>Discount</dt>
                      <dd>− {formatMoney(discountAmount)}</dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-black/10 pt-3">
                    <dt className="font-semibold text-ink">Total</dt>
                    <dd className="text-2xl font-bold tracking-tight text-ink">{formatMoney(total)}</dd>
                  </div>
                </dl>
                <p className="mt-1 text-xs text-slate-500">
                  Preview only. The server works out the final total (including any tax).
                </p>

                {saleError && (
                  <p
                    role="alert"
                    className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                  >
                    {saleError}
                  </p>
                )}

                <Button size="lg" icon={CheckCircle2} loading={submitting} onClick={checkout} className="mt-4 w-full">
                  Complete sale
                </Button>
              </>
            )}
          </section>
        </aside>
      </div>

      {receipt && <ReceiptModal sale={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

export default function PosPage() {
  return (
    <RequirePermission permission="sales:create">
      <PosScreen />
    </RequirePermission>
  );
}