import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { transactionsApi } from '../../services/api'

export default function TransactionModal({ product, onClose, onSaved }) {
  const [form, setForm] = useState({
    type: 'IN', quantity: '', reason: '', reference_no: '', notes: ''
  })

  const mutation = useMutation({
    mutationFn: () => transactionsApi.create({ ...form, product_id: product.id, quantity: parseInt(form.quantity) }),
    onSuccess: (res) => {
      toast.success(`Stock updated! New balance: ${res.data.new_stock} units`)
      onSaved()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Transaction failed'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.quantity || parseInt(form.quantity) < 1) return toast.error('Enter a valid quantity')
    mutation.mutate()
  }

  const IN_REASONS = ['Purchase Order', 'Restock', 'Return from Customer', 'Transfer In', 'Found in Count', 'Other']
  const OUT_REASONS = ['Sale', 'Transfer Out', 'Damaged/Write-off', 'Sample', 'Theft/Loss', 'Other']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-editorial-lg w-full max-w-md mx-4">
        <div className="px-6 pt-6 pb-4 border-b border-surface-container-low">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-bold text-on-surface">Stock Movement</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-container-low transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant">close</span>
            </button>
          </div>
          <p className="text-sm text-on-surface-variant">
            <span className="font-semibold">{product.name}</span> — Current: <span className="font-bold text-on-surface">{product.current_stock} {product.unit || 'units'}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type toggle */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Movement Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {['IN', 'OUT'].map(type => (
                <button
                  key={type} type="button"
                  onClick={() => setForm({ ...form, type, reason: '' })}
                  className={`py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    form.type === type
                      ? type === 'IN'
                        ? 'bg-secondary-container/30 text-secondary ring-2 ring-secondary'
                        : 'bg-primary-fixed/40 text-primary ring-2 ring-primary'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{type === 'IN' ? 'add_circle' : 'remove_circle'}</span>
                  Stock {type === 'IN' ? 'In' : 'Out'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Quantity *</label>
            <input
              required type="number" min="1" value={form.quantity}
              onChange={e => setForm({ ...form, quantity: e.target.value })}
              className="w-full bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 outline-none text-center text-2xl font-bold"
              placeholder="0"
            />
            {form.type === 'OUT' && parseInt(form.quantity) > product.current_stock && (
              <p className="text-xs text-tertiary mt-1 font-medium">⚠️ Exceeds current stock ({product.current_stock})</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Reason *</label>
            <select required value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
              className="w-full bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 outline-none">
              <option value="">Select reason...</option>
              {(form.type === 'IN' ? IN_REASONS : OUT_REASONS).map(r =>
                <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Reference No. (optional)</label>
            <input value={form.reference_no} onChange={e => setForm({ ...form, reference_no: e.target.value })}
              className="w-full bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 outline-none"
              placeholder="PO#, Invoice#, etc." />
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Notes (optional)</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={2} className="w-full bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 outline-none resize-none" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 bg-surface-container-highest rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container-high transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className={`flex-1 py-3 text-white rounded-xl text-sm font-semibold editorial-shadow active:scale-95 transition-all disabled:opacity-60 ${
                form.type === 'IN'
                  ? 'bg-secondary hover:opacity-90'
                  : 'bg-gradient-to-br from-primary-container to-primary hover:opacity-90'
              }`}>
              {mutation.isPending ? 'Processing...' : `Record Stock ${form.type}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
