const inrCurrencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const inrCompactFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatCurrencyINR(value) {
  return inrCurrencyFormatter.format(Number(value) || 0)
}

export function formatCompactCurrencyINR(value) {
  return inrCompactFormatter.format(Number(value) || 0)
}
