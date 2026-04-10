import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { transactionsApi, productsApi, alertsApi } from '../services/api'
import TransactionModal from '../components/modals/TransactionModal'

export default function Transactions() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState({ type: '', start_date: '', end_date: '', product_id: '' })
  const [page, setPage] = useState(1)
  const [txModal, setTxModal] = useState(null)
  const [tab, setTab] = useState('movements') // movements | alerts

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', filters, page],
    queryFn: () => transactionsApi.list({ ...filters, page, limit: 25 }).then(r => r.data),
  })

  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts', 'all'],
    queryFn: () => alertsApi.list({ resolved: 'false', limit: 50 }).then(r => r.data.alerts),
  })

  const { data: summaryData } = useQuery({
    queryKey: ['tx-summary'],
    queryFn: () => transactionsApi.summary({ days: 30 }).then(r => r.data),
  })

  const { data: productsData } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => productsApi.list({ limit: 200 }).then(r => r.data.products),
  })

  const resolveMutation = useMutation({
    mutationFn: (id) => alertsApi.resolve(id),
    onSuccess: () => { qc.invalidateQueries(['alerts']); toast.success('Alert resolved') },
  })

  const transactions = data?.transactions || []
  const pagination = data?.pagination || {}
  const alerts = alertsData || []

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({ format: 'csv', ...filters })
      window.open(`/api/export/transactions?${params}`, '_blank')
    } catch { toast.error('Export failed') }
  }

  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface">Stock Movements</h2>
          <p className="text-on-surface-variant mt-1 text-sm">
            {summaryData ? `${summaryData.total_transactions} transactions in last 30 days` : 'Loading...'}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExportCSV}
            className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-highest text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export Logs
          </button>
          <button onClick={() => setTxModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-primary-container to-primary text-white rounded-xl text-sm font-semibold editorial-shadow hover:opacity-90 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Manual Adjustment
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-surface-container-lowest rounded-xl editorial-shadow p-5">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Stock In (30d)</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary-container/20 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined">trending_up</span>
            </div>
            <span className="text-3xl font-bold text-on-surface">+{summaryData?.total_in?.toLocaleString() || '0'}</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl editorial-shadow p-5">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Stock Out (30d)</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-fixed/40 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">trending_down</span>
            </div>
            <span className="text-3xl font-bold text-on-surface">-{summaryData?.total_out?.toLocaleString() || '0'}</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl editorial-shadow p-5">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Active Alerts</p>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${alerts.length > 0 ? 'bg-tertiary-fixed/30 text-tertiary' : 'bg-secondary-container/20 text-secondary'}`}>
              <span className="material-symbols-outlined">{alerts.length > 0 ? 'warning' : 'check_circle'}</span>
            </div>
            <span className="text-3xl font-bold text-on-surface">{alerts.length}</span>
          </div>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 mb-6 bg-surface-container-low rounded-xl p-1 w-fit">
        {[{ key: 'movements', label: 'Movements', icon: 'swap_vert' },
          { key: 'alerts', label: `Alerts ${alerts.length > 0 ? `(${alerts.length})` : ''}`, icon: 'notifications' }
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.key
                ? 'bg-surface-container-highest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}>
            <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Movements Tab */}
      {tab === 'movements' && (
        <>
          {/* Filters */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="flex items-center gap-2 bg-surface-container-low rounded-xl px-3 col-span-2">
              <select value={filters.product_id} onChange={e => setFilters({ ...filters, product_id: e.target.value })}
                className="bg-transparent border-none text-sm focus:ring-0 outline-none py-2.5 w-full">
                <option value="">All Products</option>
                {(productsData || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 bg-surface-container-low rounded-xl px-3">
              <select value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}
                className="bg-transparent border-none text-sm focus:ring-0 outline-none py-2.5 w-full">
                <option value="">All Types</option>
                <option value="IN">Stock In</option>
                <option value="OUT">Stock Out</option>
              </select>
            </div>
            <input type="date" value={filters.start_date}
              onChange={e => setFilters({ ...filters, start_date: e.target.value })}
              className="bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
            <input type="date" value={filters.end_date}
              onChange={e => setFilters({ ...filters, end_date: e.target.value })}
              className="bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
          </div>

          {/* Table */}
          <div className="bg-surface-container-lowest rounded-xl editorial-shadow overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low">
                  <th className="py-3.5 px-5 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Date & Time</th>
                  <th className="py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Type</th>
                  <th className="py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Product</th>
                  <th className="py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Quantity</th>
                  <th className="py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Reason</th>
                  <th className="py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Reference</th>
                  <th className="py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low">
                {isLoading ? (
                  [...Array(10)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(7)].map((_, j) => (
                        <td key={j} className="py-4 px-4"><div className="skeleton h-4 rounded" /></td>
                      ))}
                    </tr>
                  ))
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-on-surface-variant text-sm">
                      <span className="material-symbols-outlined text-4xl block mb-3 text-outline">swap_vert</span>
                      No transactions found
                    </td>
                  </tr>
                ) : transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-4 px-5">
                      <p className="text-sm font-medium text-on-surface">{format(parseISO(tx.created_at), 'MMM d, yyyy')}</p>
                      <p className="text-xs text-on-surface-variant">{format(parseISO(tx.created_at), 'h:mm a')}</p>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        tx.type === 'IN'
                          ? 'bg-secondary-container/20 text-on-secondary-container'
                          : 'bg-primary-fixed/30 text-primary'
                      }`}>
                        <span className="material-symbols-outlined text-[12px]">{tx.type === 'IN' ? 'add' : 'remove'}</span>
                        {tx.type === 'IN' ? 'Stock In' : 'Stock Out'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-sm font-semibold text-on-surface">{tx.product?.name || '—'}</p>
                      <p className="text-xs text-on-surface-variant font-mono">{tx.product?.sku}</p>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`text-sm font-bold ${tx.type === 'IN' ? 'text-secondary' : 'text-primary'}`}>
                        {tx.type === 'IN' ? '+' : '-'}{tx.quantity}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm text-on-surface-variant">{tx.reason}</td>
                    <td className="py-4 px-4 text-xs text-on-surface-variant font-mono">{tx.reference_no || '—'}</td>
                    <td className="py-4 px-4 text-xs text-on-surface-variant">{tx.user?.name || 'System'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pagination.pages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-surface-container-low">
                <p className="text-xs text-on-surface-variant">
                  Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, pagination.total)} of {pagination.total}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high disabled:opacity-40">
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <span className="text-xs text-on-surface-variant px-2">Page {page} of {pagination.pages}</span>
                  <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages}
                    className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high disabled:opacity-40">
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Alerts Tab */}
      {tab === 'alerts' && (
        <div className="bg-surface-container-lowest rounded-xl editorial-shadow overflow-hidden">
          {alertsLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
            </div>
          ) : alerts.length === 0 ? (
            <div className="py-16 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl block mb-3 text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <p className="text-sm font-semibold text-on-surface">All clear!</p>
              <p className="text-xs mt-1">No active stock alerts</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-container-low">
              {alerts.map(alert => (
                <div key={alert.id} className="flex items-center gap-4 p-5 hover:bg-surface-container-low/50 transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    alert.type === 'out_of_stock' ? 'bg-tertiary-fixed/30 text-tertiary' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    <span className="material-symbols-outlined text-[20px]">
                      {alert.type === 'out_of_stock' ? 'do_not_disturb_on' : 'warning'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-on-surface">{alert.product?.name}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{alert.message}</p>
                    <p className="text-[10px] text-outline mt-0.5">{format(parseISO(alert.created_at), 'MMM d, yyyy • h:mm a')}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                      alert.type === 'out_of_stock' ? 'bg-tertiary text-white' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {alert.type === 'out_of_stock' ? 'Out of Stock' : 'Low Stock'}
                    </span>
                    <button onClick={() => resolveMutation.mutate(alert.id)}
                      disabled={resolveMutation.isPending}
                      className="text-xs font-semibold text-primary hover:underline px-2 py-1 rounded-lg hover:bg-primary-fixed/20 transition-colors">
                      Resolve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick transaction modal (when no specific product chosen) */}
      {txModal === true && (
        <QuickTxModal
          products={productsData || []}
          onClose={() => setTxModal(null)}
          onSaved={() => { qc.invalidateQueries(['transactions']); qc.invalidateQueries(['alerts']); setTxModal(null) }}
        />
      )}
    </div>
  )
}

function QuickTxModal({ products, onClose, onSaved }) {
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [productSearch, setProductSearch] = useState('')

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 8)

  if (selectedProduct) {
    return <TransactionModal product={selectedProduct} onClose={onClose} onSaved={onSaved} />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-editorial-lg w-full max-w-md mx-4">
        <div className="px-6 pt-6 pb-4 border-b border-surface-container-low flex items-center justify-between">
          <h2 className="text-xl font-bold text-on-surface">Select Product</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-container-low">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-2 bg-surface-container-low rounded-xl px-4 mb-4">
            <span className="material-symbols-outlined text-on-surface-variant text-[18px]">search</span>
            <input type="text" placeholder="Search products..." value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              className="bg-transparent border-none py-2.5 text-sm focus:ring-0 outline-none flex-1" />
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto scrollbar-thin">
            {filtered.map(p => (
              <button key={p.id} onClick={() => setSelectedProduct(p)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-container-low transition-colors text-left">
                <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">inventory_2</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">{p.name}</p>
                  <p className="text-xs text-on-surface-variant">SKU: {p.sku} · Stock: {p.current_stock}</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant text-[18px]">chevron_right</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-on-surface-variant text-center py-8">No products found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
