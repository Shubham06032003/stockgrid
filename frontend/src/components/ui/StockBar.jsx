const BAR_VARIANTS = {
  in_stock: 'bg-secondary',
  low: 'bg-amber-400 dark:bg-amber-300',
  out_of_stock: 'bg-tertiary',
};

export default function StockBar({ current = 0, min = 0, status = 'in_stock', unit = 'units' }) {
  const safeCurrent = Number(current) || 0;
  const safeMin = Number(min) || 0;
  const percent = safeMin > 0
    ? Math.max(0, Math.min(100, (safeCurrent / (safeMin * 2)) * 100))
    : (safeCurrent > 0 ? 100 : 0);

  return (
    <div className="flex min-w-[10rem] flex-col gap-1">
      <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-on-surface-variant">
        <span className="truncate">{safeCurrent} {unit}</span>
        <span>{Math.round(percent)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
        <div
          className={`h-full rounded-full transition-all duration-300 ${BAR_VARIANTS[status] || BAR_VARIANTS.in_stock}`}
          style={{ width: `${Math.max(2, percent)}%` }}
        />
      </div>
    </div>
  );
}
