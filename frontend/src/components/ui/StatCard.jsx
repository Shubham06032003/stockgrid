import StatusBadge from './StatusBadge';

function resolveBadgeVariant(variant) {
  if (variant === 'success' || variant === 'danger' || variant === 'warning' || variant === 'neutral' || variant === 'info') {
    return variant;
  }
  return 'neutral';
}

export default function StatCard({ label, value, badge, badgeVariant = 'neutral', icon, loading }) {
  if (loading) {
    return (
      <div className="rounded-xl bg-surface-container-lowest p-5 shadow-sm ring-1 ring-outline-variant/20">
        <div className="skeleton mb-4 h-4 w-24 rounded" />
        <div className="skeleton h-8 w-32 rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface-container-lowest p-5 shadow-sm ring-1 ring-outline-variant/20 transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium text-on-surface-variant">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">{value}</p>
        </div>
        {icon ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
          </div>
        ) : null}
      </div>
      {badge ? (
        <div className="mt-4 flex items-center justify-end">
          <StatusBadge variant={resolveBadgeVariant(badgeVariant)}>{badge}</StatusBadge>
        </div>
      ) : null}
    </div>
  );
}
