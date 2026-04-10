export default function CategoryBadge({ children, className = '' }) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full bg-surface-container px-2.5 py-1 text-xs font-medium text-on-surface-variant ring-1 ring-outline-variant/40 ${className}`.trim()}
      title={children}
    >
      <span className="truncate">{children || 'Uncategorized'}</span>
    </span>
  );
}
