import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { reportsApi, aiApi, alertsApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { formatCompactCurrencyINR, formatCurrencyINR } from '../utils/currency';

const PIE_COLORS = ['#3525cd', '#006c49', '#960014', '#4d44e3', '#4edea3', '#ffb3ad'];

function formatChartDate(value, pattern) {
  try {
    return format(parseISO(value), pattern);
  } catch {
    return value;
  }
}

function InsightCard({ insight, index }) {
  const variant = insight?.type === 'warning'
    ? 'danger'
    : insight?.type === 'opportunity'
      ? 'success'
      : 'info';

  return (
    <div
      className="rounded-xl bg-surface-container-low p-4 ring-1 ring-outline-variant/20"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-on-surface">{insight?.title || 'Insight'}</p>
        <StatusBadge variant={variant}>{insight?.type || 'info'}</StatusBadge>
      </div>
      <p className="text-sm leading-6 text-on-surface-variant">{insight?.description}</p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const [aiInsights, setAiInsights] = useState(null);

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => reportsApi.dashboard().then((r) => r.data),
  });

  const { data: alerts } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => alertsApi.list({ resolved: 'false', limit: 5 }).then((r) => r.data.alerts),
  });

  const insightsMutation = useMutation({
    mutationFn: () => aiApi.dashboardInsights(dashData),
    onSuccess: (res) => setAiInsights(res.data.insights),
    onError: () => toast.error('AI insights unavailable. Check your Gemini API key.'),
  });

  const kpis = dashData?.kpis;
  const salesTrend = dashData?.sales_trend || [];
  const categories = dashData?.category_distribution || [];
  const recent = dashData?.recent_transactions || [];

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-on-surface">Inventory Command</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              {format(new Date(), 'MMMM d, yyyy')} | Welcome back, {user?.name?.split(' ')[0]}
            </p>
          </div>
          <button
            onClick={() => insightsMutation.mutate()}
            disabled={insightsMutation.isPending || !dashData}
            className="inline-flex cursor-pointer items-center gap-2 self-start rounded-xl bg-surface-container-highest px-4 py-2.5 text-sm font-medium text-on-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">psychology</span>
            {insightsMutation.isPending ? 'Analyzing...' : 'AI Insights'}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total SKUs" value={kpis?.total_skus?.toLocaleString() || '-'} badge="+2.4%" badgeVariant="success" icon="inventory_2" loading={isLoading} />
          <StatCard label="Total Stock Value" value={kpis ? formatCompactCurrencyINR(kpis.total_stock_value) : '-'} badge="Portfolio value" badgeVariant="info" icon="payments" loading={isLoading} />
          <StatCard label="Monthly Profit" value={kpis?.profit_last_30d != null ? formatCurrencyINR(kpis.profit_last_30d) : '-'} badge="30 Days" badgeVariant="success" icon="trending_up" loading={isLoading} />
          <StatCard label="Out of Stock" value={kpis?.out_of_stock ?? '-'} badge={kpis?.out_of_stock > 0 ? 'Critical' : 'Clear'} badgeVariant={kpis?.out_of_stock > 0 ? 'danger' : 'success'} icon="error" loading={isLoading} />
          <StatCard label="Low Stock" value={kpis?.low_stock ?? '-'} badge={kpis?.low_stock > 0 ? 'Attention' : 'Healthy'} badgeVariant={kpis?.low_stock > 0 ? 'warning' : 'success'} icon="warning" loading={isLoading} />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <div className="grid grid-cols-1 gap-6">
              <div className="rounded-xl bg-surface-container-lowest p-6 shadow-sm ring-1 ring-outline-variant/20 transition-shadow duration-200 hover:shadow-md">
                <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-on-surface">Stock Movement Trend</h3>
                    <p className="mt-1 text-sm text-on-surface-variant">Last 7 days of inbound and outbound inventory</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-on-surface-variant">
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-secondary" />Stock In</span>
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-primary" />Stock Out</span>
                  </div>
                </div>
                {isLoading ? (
                  <div className="skeleton h-56 rounded-xl" />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={salesTrend}>
                      <defs>
                        <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#006c49" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#006c49" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3525cd" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#3525cd" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d7dbe1" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => formatChartDate(v, 'MMM d')} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(v, n) => [v ?? 0, n === 'in' ? 'Stock In' : 'Stock Out']}
                        labelFormatter={(l) => formatChartDate(l, 'MMM d, yyyy')}
                      />
                      <Area type="monotone" dataKey="in" stroke="#006c49" strokeWidth={2.5} fill="url(#colorIn)" />
                      <Area type="monotone" dataKey="out" stroke="#3525cd" strokeWidth={2.5} fill="url(#colorOut)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="rounded-xl bg-surface-container-lowest p-6 shadow-sm ring-1 ring-outline-variant/20 transition-shadow duration-200 hover:shadow-md">
                <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-on-surface">Revenue vs Profit</h3>
                    <p className="mt-1 text-sm text-on-surface-variant">Financial performance across the last week</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-on-surface-variant">
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#3525cd]" />Revenue</span>
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#4edea3]" />Profit</span>
                  </div>
                </div>
                {isLoading ? (
                  <div className="skeleton h-56 rounded-xl" />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={salesTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d7dbe1" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => formatChartDate(v, 'MMM d')} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(v, n) => [formatCurrencyINR(v || 0), n === 'revenue' ? 'Revenue' : 'Profit']}
                        labelFormatter={(l) => formatChartDate(l, 'MMM d, yyyy')}
                      />
                      <Bar dataKey="revenue" fill="#3525cd" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="profit" fill="#4edea3" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl bg-surface-container-lowest p-6 shadow-sm ring-1 ring-outline-variant/20 transition-shadow duration-200 hover:shadow-md">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-on-surface">By Category</h3>
                <p className="mt-1 text-sm text-on-surface-variant">Current stock value distribution</p>
              </div>
              {isLoading ? (
                <div className="skeleton h-56 rounded-xl" />
              ) : categories.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={categories} cx="50%" cy="50%" innerRadius={48} outerRadius={78} dataKey="value" paddingAngle={2}>
                        {categories.map((category, index) => (
                          <Cell key={category.id || category.name || `category-cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [formatCurrencyINR(v || 0), 'Value']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-3 space-y-2">
                    {categories.slice(0, 4).map((category, index) => (
                      <div key={category.id || category.name || `category-${index}`} className="flex items-center justify-between gap-3 rounded-lg px-1 py-1 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                          <span className="truncate text-on-surface-variant">{category.name}</span>
                        </div>
                        <span className="font-semibold text-on-surface">{category.count} SKUs</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex h-56 items-center justify-center rounded-xl bg-surface-container-low text-sm text-on-surface-variant">
                  No data yet
                </div>
              )}
            </div>

            {alerts && alerts.length > 0 ? (
              <div className="rounded-xl border border-tertiary/10 bg-tertiary-fixed/20 p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-tertiary text-white">
                    <span className="material-symbols-outlined text-[18px]">warning</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-on-surface">Stock Alerts</h3>
                    <p className="text-xs text-on-surface-variant">Items needing attention right now</p>
                  </div>
                  <StatusBadge variant="danger" className="ml-auto">{alerts.length}</StatusBadge>
                </div>
                <div className="space-y-3">
                  {alerts.slice(0, 3).map((alert, index) => (
                    <div key={alert.id || alert.product?.id || `alert-${index}`} className="rounded-lg bg-surface-container-lowest/60 p-3">
                      <p className="text-sm font-medium text-on-surface">{alert.product?.name || 'Product alert'}</p>
                      <p className="mt-1 text-xs leading-5 text-on-surface-variant">{alert.message}</p>
                    </div>
                  ))}
                </div>
                <a href="/transactions" className="mt-4 inline-flex items-center text-xs font-semibold text-primary hover:underline">
                  Manage alerts
                </a>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-xl bg-surface-container-lowest p-6 shadow-sm ring-1 ring-outline-variant/20 xl:col-span-2">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-on-surface">Recent Transactions</h3>
                <p className="mt-1 text-sm text-on-surface-variant">Latest inventory movements across your workspace</p>
              </div>
              <a href="/transactions" className="text-sm font-semibold text-primary hover:underline">View all</a>
            </div>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, index) => <div key={`recent-skeleton-${index}`} className="skeleton h-14 rounded-xl" />)}
              </div>
            ) : recent.length > 0 ? (
              <div className="space-y-3">
                {recent.map((tx, index) => (
                  <div
                    key={tx.id || `${tx.product?.id || tx.product?.name || 'transaction'}-${index}`}
                    className="flex items-center gap-4 rounded-xl border border-transparent px-3 py-3 transition-colors duration-200 hover:bg-surface-container-low"
                  >
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                      tx.type === 'IN' ? 'bg-secondary-container/20 text-secondary' : 'bg-primary-fixed/40 text-primary'
                    }`}>
                      <span className="material-symbols-outlined text-[18px]">{tx.type === 'IN' ? 'add' : 'remove'}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-on-surface">{tx.product?.name || 'Product'}</p>
                      <p className="truncate text-xs text-on-surface-variant">{tx.reason || 'Stock adjustment'}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${tx.type === 'IN' ? 'text-secondary' : 'text-primary'}`}>
                        {tx.type === 'IN' ? '+' : '-'}{tx.quantity}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {tx.created_at ? format(parseISO(tx.created_at), 'MMM d') : '-'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-on-surface-variant">No recent transactions</p>
            )}
          </div>

          <div className="rounded-xl bg-surface-container-lowest p-5 shadow-sm ring-1 ring-outline-variant/20">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-on-surface">AI Analysis</h3>
                <p className="text-xs text-on-surface-variant">Quick recommendations from current dashboard data</p>
              </div>
            </div>

            {insightsMutation.isPending ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, index) => <div key={`insight-skeleton-${index}`} className="skeleton h-20 rounded-xl" />)}
              </div>
            ) : aiInsights ? (
              <div className="space-y-3">
                {aiInsights.map((insight, index) => (
                  <InsightCard key={insight?.id || insight?.title || `insight-card-${index}`} insight={insight} index={index} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-surface-container-low p-4 text-center">
                <p className="mb-3 text-sm leading-6 text-on-surface-variant">
                  Generate a quick read on performance, risks, and opportunities from your latest inventory data.
                </p>
                <button
                  onClick={() => insightsMutation.mutate()}
                  disabled={!dashData}
                  className="text-sm font-semibold text-primary transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  Generate insights
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
