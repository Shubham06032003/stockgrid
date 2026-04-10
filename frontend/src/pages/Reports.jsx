import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import toast from 'react-hot-toast'
import { reportsApi } from '../services/api'
import { formatCompactCurrencyINR, formatCurrencyINR } from '../utils/currency'

const COLORS = ['#3525cd', '#006c49', '#960014', '#4d44e3', '#4edea3', '#ffb3ad', '#c3c0ff', '#6cf8bb']

function StatCard({ label, value, sub, icon, color = 'primary' }) {
  const colorMap = {
    primary: 'bg-primary-fixed/30 text-primary',
    green: 'bg-secondary-container/20 text-secondary',
    red: 'bg-tertiary-fixed/30 text-tertiary',
    purple: 'bg-primary-fixed/40 text-primary',
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl editorial-shadow p-6">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
      </div>
      <h3 className="text-2xl font-bold text-on-surface mb-0.5">{value}</h3>
      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{label}</p>
      {sub && <p className="text-xs text-on-surface-variant mt-1">{sub}</p>}
    </div>
  )
}

export default function Reports() {
  const [topDays, setTopDays] = useState(30)

  const { data: valuation, isLoading: valLoading } = useQuery({
    queryKey: ['valuation'],
    queryFn: () => reportsApi.valuation().then(r => r.data),
  })

  const { data: topProducts, isLoading: topLoading } = useQuery({
    queryKey: ['top-products', topDays],
    queryFn: () => reportsApi.topProducts({ days: topDays }).then(r => r.data),
  })

  const { data: deadStock } = useQuery({
    queryKey: ['dead-stock-report'],
    queryFn: () => reportsApi.deadStock({ days: 60 }).then(r => r.data),
  })

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => reportsApi.dashboard().then(r => r.data),
    staleTime: 30000,
  })

  const handleExport = (type) => {
    const format = 'csv'
    const params = new URLSearchParams({ format })
    window.open(`/api/export/${type}?${params}`, '_blank')
    toast.success(`Exporting ${type}...`)
  }

  const valItems = valuation?.valuation || []
  const topItems = topProducts?.top_products || []
  const deadItems = deadStock?.dead_stock || []
  const catData = dashboard?.category_distribution || []

  const totalValue = valuation?.total_value || 0
  const outOfStock = valItems.filter(p => p.status === 'out_of_stock').length
  const lowStock = valItems.filter(p => p.status === 'low_stock').length
  const inStock = valItems.filter(p => p.status === 'in_stock').length
  const totalProfit = valItems.reduce((acc, p) => acc + (p.total_profit || 0), 0)

  return (
    <div className="px-8 py-8">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface">Reports & Analytics</h2>
          <p className="text-on-surface-variant mt-1 text-sm">Inventory intelligence and performance insights</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => handleExport('products')}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-highest text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export Products
          </button>
          <button
            onClick={() => handleExport('transactions')}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-highest text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export Transactions
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard label="Total Inventory Value" value={formatCompactCurrencyINR(totalValue)} icon="account_balance_wallet" color="primary" sub={`${valItems.length} SKUs tracked`} />
        <StatCard label="In Stock" value={inStock} icon="check_circle" color="green" sub="Healthy stock level" />
        <StatCard label="Low Stock" value={lowStock} icon="warning" color="purple" sub="Need attention" />
        <StatCard label="Out of Stock" value={outOfStock} icon="do_not_disturb_on" color="red" sub="Critical - reorder now" />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-surface-container-lowest rounded-xl editorial-shadow p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-on-surface">Top Selling Products</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">By units sold</p>
            </div>
            <select
              value={topDays}
              onChange={e => setTopDays(Number(e.target.value))}
              className="bg-surface-container-low border-none rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-0 outline-none"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
          {topLoading ? (
            <div className="skeleton h-56 rounded-lg" />
          ) : topItems.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topItems.slice(0, 8)} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#edeef0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#464555' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#464555' }} width={120} />
                <Tooltip formatter={(v) => [v, 'Units Sold']} />
                <Bar dataKey="total_sold" fill="#3525cd" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-56 flex items-center justify-center text-sm text-on-surface-variant">No sales data yet</div>
          )}
        </div>

        <div className="bg-surface-container-lowest rounded-xl editorial-shadow p-6">
          <h3 className="font-bold text-on-surface mb-1">Stock by Category</h3>
          <p className="text-xs text-on-surface-variant mb-5">Value distribution</p>
          {catData.length > 0 ? (
            <div className="flex gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={catData} cx="50%" cy="50%" outerRadius={80} dataKey="value" paddingAngle={2}>
                    {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => [formatCurrencyINR(v), 'Value']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2.5 self-center">
                {catData.map((cat, i) => (
                  <div key={cat.name} className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-on-surface truncate">{cat.name}</p>
                      <p className="text-[10px] text-on-surface-variant">{cat.count} SKUs</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-sm text-on-surface-variant">No data yet</div>
          )}
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl editorial-shadow overflow-hidden mb-6">
        <div className="px-6 py-5 border-b border-surface-container-low flex items-center justify-between">
          <div>
            <h3 className="font-bold text-on-surface">Inventory Valuation & Profitability</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">Stock value and historical profit per product</p>
          </div>
          <div className="flex gap-6">
            <span className="text-sm font-bold text-on-surface">Total Value: <span className="text-primary">{formatCurrencyINR(totalValue)}</span></span>
            <span className="text-sm font-bold text-on-surface">Historical Profit: <span className="text-secondary">{formatCurrencyINR(totalProfit)}</span></span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low">
                {['Product', 'SKU', 'Category', 'Stock', 'Unit Price', 'Cost', 'Margin %', 'Profit', 'Status'].map(h => (
                  <th key={h} className="py-3.5 px-5 text-xs font-bold uppercase tracking-wider text-on-surface-variant whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {valLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((__, j) => (
                      <td key={j} className="py-4 px-5"><div className="skeleton h-4 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : valItems.slice(0, 20).map(p => (
                <tr key={p.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="py-4 px-5 text-sm font-semibold text-on-surface">{p.name}</td>
                  <td className="py-4 px-5 text-xs font-mono text-on-surface-variant">{p.sku}</td>
                  <td className="py-4 px-5">
                    <span className="px-2.5 py-1 rounded-lg bg-surface-container text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{p.category}</span>
                  </td>
                  <td className="py-4 px-5 text-sm font-bold text-on-surface">{p.current_stock}</td>
                  <td className="py-4 px-5 text-sm text-on-surface">{formatCurrencyINR(p.unit_price)}</td>
                  <td className="py-4 px-5 text-sm text-on-surface">{formatCurrencyINR(p.cost_price || 0)}</td>
                  <td className="py-4 px-5 text-sm font-bold text-on-surface">{p.margin_pct}%</td>
                  <td className="py-4 px-5 text-sm font-bold text-secondary">{formatCurrencyINR(p.total_profit || 0)}</td>
                  <td className="py-4 px-5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                      p.status === 'in_stock' ? 'bg-secondary-container/20 text-on-secondary-container' :
                      p.status === 'low_stock' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-tertiary-fixed/30 text-tertiary'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                      {p.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {valItems.length > 20 && (
          <div className="py-3 text-center text-xs text-on-surface-variant border-t border-surface-container-low">
            Showing 20 of {valItems.length} products. Export CSV for full report.
          </div>
        )}
      </div>

      {deadItems.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl editorial-shadow overflow-hidden">
          <div className="px-6 py-5 border-b border-surface-container-low flex items-center gap-3">
            <span className="material-symbols-outlined text-tertiary">inventory</span>
            <div>
              <h3 className="font-bold text-on-surface">Dead Stock (60+ days no sales)</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {deadItems.length} items at risk: {formatCurrencyINR(deadItems.reduce((sum, item) => sum + item.value, 0))}
              </p>
            </div>
          </div>
          <div className="divide-y divide-surface-container-low">
            {deadItems.map(p => (
              <div key={p.id} className="flex items-center gap-4 px-6 py-4 hover:bg-surface-container-low/50 transition-colors">
                <div className="flex-1">
                  <p className="text-sm font-bold text-on-surface">{p.name}</p>
                  <p className="text-xs text-on-surface-variant font-mono">{p.sku} - {p.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-on-surface">{p.current_stock} units</p>
                  <p className="text-xs text-tertiary font-semibold">{formatCurrencyINR(p.value)} at risk</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
