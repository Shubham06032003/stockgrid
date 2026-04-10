const STATUS_VARIANTS = {
  success: 'bg-secondary-container/20 text-secondary ring-1 ring-secondary/10',
  danger: 'bg-tertiary-fixed/40 text-tertiary ring-1 ring-tertiary/10',
  warning: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/20',
  neutral: 'bg-surface-container text-on-surface-variant ring-1 ring-outline-variant/40',
  info: 'bg-primary-fixed/40 text-primary ring-1 ring-primary/10',
};

export default function StatusBadge({ children, variant = 'neutral', className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${STATUS_VARIANTS[variant] || STATUS_VARIANTS.neutral} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
