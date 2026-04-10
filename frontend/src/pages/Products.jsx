import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { productsApi, suppliersApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import ProductModal from '../components/modals/ProductModal';
import TransactionModal from '../components/modals/TransactionModal';
import BulkTransactionModal from '../components/modals/BulkTransactionModal';
import ImportModal from '../components/modals/ImportModal';
import CategoryBadge from '../components/ui/CategoryBadge';
import StatusBadge from '../components/ui/StatusBadge';
import StockBar from '../components/ui/StockBar';
import { formatCurrencyINR } from '../utils/currency';

const STATUS_LABELS = { in_stock: 'In Stock', low: 'Low Stock', out_of_stock: 'Out of Stock' };
const STATUS_VARIANTS = { in_stock: 'success', low: 'warning', out_of_stock: 'danger' };

function TableHeader({ children, className = '' }) {
  return (
    <th className={`px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant ${className}`.trim()}>
      {children}
    </th>
  );
}

export default function Products() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const canEdit = ['admin', 'manager'].includes(user?.role);

  const [filters, setFilters] = useState({ search: '', category: '', stock_status: '', supplier_id: '' });
  const [page, setPage] = useState(1);
  const [productModal, setProductModal] = useState(null);
  const [txModal, setTxModal] = useState(null);
  const [bulkTxModal, setBulkTxModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [selected, setSelected] = useState([]);

  const { data, isLoading } = useQuery({
    queryKey: ['products', filters, page],
    queryFn: () => productsApi.list({ ...filters, page, limit: 20 }).then((r) => r.data),
    keepPreviousData: true,
  });

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => suppliersApi.list().then((r) => r.data.suppliers),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => productsApi.categories().then((r) => r.data.categories),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => productsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries(['products']);
      toast.success('Product deleted');
    },
    onError: () => toast.error('Delete failed'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => productsApi.bulkDelete(ids),
    onSuccess: (res) => {
      qc.invalidateQueries(['products']);
      toast.success(res.data.message);
      setSelected([]);
    },
    onError: () => toast.error('Bulk delete failed'),
  });

  const products = data?.products || [];
  const pagination = data?.pagination || {};
  const allVisibleSelected = products.length > 0 && selected.length === products.length;

  const pageButtons = useMemo(() => {
    const totalPages = pagination.pages || 0;
    return Array.from({ length: Math.min(5, totalPages) }, (_, index) => index + 1);
  }, [pagination.pages]);

  const handleBulkDelete = () => {
    if (confirm(`Are you sure you want to delete ${selected.length} products?`)) {
      bulkDeleteMutation.mutate(selected);
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleExport = async () => {
    try {
      const res = await productsApi.list({ ...filters, limit: 9999 });
      const prods = res.data.products;
      const rows = prods.map((product) => ({
        Name: product.name,
        SKU: product.sku,
        Category: product.category,
        Price: product.price,
        Stock: product.current_stock,
        'Min Stock': product.min_stock,
        Status: STATUS_LABELS[product.stock_status] || product.stock_status,
      }));
      const headers = Object.keys(rows[0] || {});
      const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => `"${row[header] ?? ''}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'products.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <nav className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              <span>Inventory</span>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span className="text-primary">Products</span>
            </nav>
            <h2 className="text-3xl font-bold tracking-tight text-on-surface">Products</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Track, update, and review the items in your catalog.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setImportModal(true)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-surface-container-highest px-5 py-2.5 text-sm font-semibold text-on-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="material-symbols-outlined text-lg">upload_file</span>
              Import
            </button>
            <button
              onClick={handleExport}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-surface-container-highest px-5 py-2.5 text-sm font-semibold text-on-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              Export
            </button>
            {canEdit ? (
              <button
                onClick={() => setProductModal('new')}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-br from-primary-container to-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Add Product
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2 rounded-xl bg-surface-container-low px-4 py-3 ring-1 ring-outline-variant/20">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">search</span>
              <input
                type="text"
                placeholder="Search name or SKU..."
                value={filters.search}
                onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }}
                className="w-full bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
              />
            </div>
          </div>
          <div className="lg:col-span-2">
            <select
              value={filters.category}
              onChange={(e) => { setFilters({ ...filters, category: e.target.value }); setPage(1); }}
              className="w-full rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant/20"
            >
              <option value="">All Categories</option>
              {(categoriesData || []).map((category, index) => (
                <option key={category || `category-option-${index}`} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-3">
            <select
              value={filters.stock_status}
              onChange={(e) => { setFilters({ ...filters, stock_status: e.target.value }); setPage(1); }}
              className="w-full rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant/20"
            >
              <option value="">All Status</option>
              <option value="in_stock">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </div>
          <div className="lg:col-span-3">
            <select
              value={filters.supplier_id}
              onChange={(e) => { setFilters({ ...filters, supplier_id: e.target.value }); setPage(1); }}
              className="w-full rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant/20"
            >
              <option value="">All Suppliers</option>
              {(suppliersData || []).map((supplier, index) => (
                <option key={supplier.id || `${supplier.name}-${index}`} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </div>
        </div>

        {selected.length > 0 ? (
          <div className="flex flex-col gap-4 rounded-xl border border-secondary/10 bg-secondary-container/20 px-5 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 text-sm font-semibold text-on-secondary-container">
              <span className="material-symbols-outlined text-secondary">library_add_check</span>
              {selected.length} product(s) selected
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setBulkTxModal(true)} className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-secondary/90">
                Bulk Stock Update
              </button>
              <button onClick={() => setSelected([])} className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-low">
                Clear
              </button>
              {canEdit ? (
                <button
                  onClick={handleBulkDelete}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-tertiary/10 text-tertiary transition hover:bg-tertiary hover:text-white"
                  title="Delete Selected"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm ring-1 ring-outline-variant/20">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-surface-container-low">
                <tr>
                  <TableHeader className="w-14">
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
                        checked={allVisibleSelected}
                        onChange={(e) => setSelected(e.target.checked ? products.map((product) => product.id) : [])}
                      />
                    </div>
                  </TableHeader>
                  <TableHeader className="min-w-[16rem]">Product</TableHeader>
                  <TableHeader className="min-w-[10rem]">Category</TableHeader>
                  <TableHeader className="min-w-[10rem]">Supplier</TableHeader>
                  <TableHeader className="min-w-[12rem]">Stock Level</TableHeader>
                  <TableHeader className="min-w-[8rem]">Unit Price</TableHeader>
                  <TableHeader className="min-w-[9rem]">Status</TableHeader>
                  <TableHeader className="w-28 text-right">Actions</TableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low">
                {isLoading ? (
                  [...Array(8)].map((_, rowIndex) => (
                    <tr key={`product-skeleton-${rowIndex}`}>
                      {[...Array(8)].map((__, cellIndex) => (
                        <td key={`product-skeleton-${rowIndex}-${cellIndex}`} className="px-4 py-5">
                          <div className="skeleton h-4 rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center text-sm text-on-surface-variant">
                      <span className="material-symbols-outlined mb-3 block text-4xl text-outline">inventory_2</span>
                      No products found.
                      {canEdit ? (
                        <button onClick={() => setProductModal('new')} className="ml-1 font-semibold text-primary hover:underline">
                          Add your first product
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ) : (
                  products.map((product, index) => (
                    <tr key={product.id || `${product.name}-${index}`} className="group transition hover:bg-surface-container-low/70">
                      <td className="px-4 py-5 align-middle">
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={selected.includes(product.id)}
                            onChange={() => toggleSelect(product.id)}
                            className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-5 align-middle">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant">
                            <span className="material-symbols-outlined">inventory_2</span>
                          </div>
                          <div className="min-w-0">
                            <p className="max-w-[16rem] truncate text-sm font-semibold text-on-surface" title={product.name}>
                              {product.name}
                            </p>
                            <p className="mt-1 max-w-[16rem] truncate text-xs font-medium text-on-surface-variant" title={product.sku}>
                              SKU: <span className="font-mono">{product.sku}</span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-5 align-middle">
                        <CategoryBadge>{product.category}</CategoryBadge>
                      </td>
                      <td className="px-4 py-5 align-middle">
                        <p className="max-w-[10rem] truncate text-sm font-medium text-on-surface" title={product.supplier?.name || product.supplier_name || '-'}>
                          {product.supplier?.name || product.supplier_name || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-5 align-middle">
                        <StockBar current={product.current_stock} min={product.min_stock} status={product.stock_status} unit={product.unit || 'units'} />
                      </td>
                      <td className="px-4 py-5 align-middle text-sm font-semibold text-on-surface">
                        {formatCurrencyINR(product.price || 0)}
                      </td>
                      <td className="px-4 py-5 align-middle">
                        <StatusBadge variant={STATUS_VARIANTS[product.stock_status] || 'neutral'}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                          {STATUS_LABELS[product.stock_status] || product.stock_status}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-5 align-middle">
                        <div className="flex items-center justify-end gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
                          <button
                            onClick={() => setTxModal(product)}
                            className="cursor-pointer rounded-lg p-2 text-secondary transition-colors hover:bg-secondary-container/20"
                            title="Stock movement"
                          >
                            <span className="material-symbols-outlined text-[18px]">swap_vert</span>
                          </button>
                          {canEdit ? (
                            <>
                              <button
                                onClick={() => setProductModal(product)}
                                className="cursor-pointer rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high"
                                title="Edit product"
                              >
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Delete "${product.name}"?`)) deleteMutation.mutate(product.id);
                                }}
                                className="cursor-pointer rounded-lg p-2 text-tertiary transition-colors hover:bg-tertiary-fixed/20"
                                title="Delete product"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 ? (
            <div className="flex flex-col gap-3 border-t border-surface-container-low px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-on-surface-variant">
                Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, pagination.total)} of {pagination.total}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                {pageButtons.map((pageNumber) => (
                  <button
                    key={`page-${pageNumber}`}
                    onClick={() => setPage(pageNumber)}
                    className={`h-9 w-9 rounded-lg text-xs font-semibold transition-colors ${
                      page === pageNumber ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={page === pagination.pages}
                  className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {productModal !== null ? (
        <ProductModal
          product={productModal === 'new' ? null : productModal}
          suppliers={suppliersData || []}
          onClose={() => setProductModal(null)}
          onSaved={() => { qc.invalidateQueries(['products']); setProductModal(null); }}
        />
      ) : null}
      {txModal ? (
        <TransactionModal
          product={txModal}
          onClose={() => setTxModal(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['products'] });
            qc.invalidateQueries({ queryKey: ['alerts'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            setTxModal(null);
          }}
        />
      ) : null}
      {bulkTxModal ? (
        <BulkTransactionModal
          products={products.filter((product) => selected.includes(product.id))}
          onClose={() => setBulkTxModal(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['products'] });
            qc.invalidateQueries({ queryKey: ['alerts'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            setBulkTxModal(false);
            setSelected([]);
          }}
        />
      ) : null}
      {importModal ? (
        <ImportModal
          onClose={() => setImportModal(false)}
          onImported={() => { qc.invalidateQueries(['products']); setImportModal(false); }}
        />
      ) : null}
    </div>
  );
}
