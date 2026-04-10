import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { suppliersApi, importExportApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import SupplierImportModal from '../components/modals/SupplierImportModal'

function SupplierModal({ supplier, onClose, onSaved }) {
  const isEdit = !!supplier
  const [form, setForm] = useState({
    name: supplier?.name || '',
    contact_email: supplier?.contact_email || '',
    phone: supplier?.phone || '',
    address: supplier?.address || '',
    lead_time_days: supplier?.lead_time_days?.toString() || '7',
    notes: supplier?.notes || '',
  })

  const mutation = useMutation({
    mutationFn: () => isEdit
      ? suppliersApi.update(supplier.id, form)
      : suppliersApi.create(form),
    onSuccess: () => { toast.success(isEdit ? 'Supplier updated!' : 'Supplier added!'); onSaved() },
    onError: (err) => toast.error(err.response?.data?.error || 'Save failed'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-editorial-lg w-full max-w-md mx-4">
        <div className="px-6 pt-6 pb-4 border-b border-surface-container-low flex items-center justify-between">
          <h2 className="text-xl font-bold text-on-surface">{isEdit ? 'Edit Supplier' : 'Add Supplier'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-container-low">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate() }} className="p-6 space-y-4">
          {[
            { key: 'name', label: 'Supplier Name', required: true, placeholder: 'Acme Suppliers Inc.' },
            { key: 'contact_email', label: 'Contact Email', type: 'email', placeholder: 'orders@supplier.com' },
            { key: 'phone', label: 'Phone', placeholder: '+1 555 000 0000' },
            { key: 'address', label: 'Address', placeholder: '123 Warehouse Rd, City' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                {f.label}{f.required && <span className="text-tertiary ml-0.5">*</span>}
              </label>
              <input required={f.required} type={f.type || 'text'} value={form[f.key]}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Lead Time (days)</label>
            <input type="number" min="1" value={form.lead_time_days}
              onChange={e => setForm({ ...form, lead_time_days: e.target.value })}
              className="w-full bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={2} className="w-full bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 outline-none resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 bg-surface-container-highest rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-3 bg-gradient-to-br from-primary-container to-primary text-white rounded-xl text-sm font-semibold editorial-shadow hover:opacity-90 disabled:opacity-60 active:scale-95 transition-all">
              {mutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Suppliers() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const canEdit = ['admin', 'manager'].includes(user?.role)
  const [modal, setModal] = useState(null)
  const [importModal, setImportModal] = useState(false)
  const [selected, setSelected] = useState([])

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => suppliersApi.list().then(r => r.data.suppliers),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => suppliersApi.delete(id),
    onSuccess: () => { qc.invalidateQueries(['suppliers']); toast.success('Supplier deleted'); setSelected([]) },
    onError: () => toast.error('Delete failed'),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => suppliersApi.bulkDelete(ids),
    onSuccess: (res) => {
      qc.invalidateQueries(['suppliers'])
      toast.success(res.data.message)
      setSelected([])
    },
    onError: () => toast.error('Bulk delete failed'),
  })

  const handleBulkDelete = () => {
    if (confirm(`Delete ${selected.length} suppliers?`)) {
      bulkDeleteMutation.mutate(selected)
    }
  }

  const suppliers = data || []

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleExport = async () => {
    try {
      const p = selected.length > 0 ? { ids: selected.join(',') } : {}
      const res = await importExportApi.exportSuppliers(p)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `suppliers_export.csv`
      a.click()
    } catch { toast.error('Export failed') }
  }

  return (
    <div className="px-8 py-8">
      <div className="flex items-end justify-between mb-8">
        <div>
          <nav className="flex items-center gap-1 text-xs font-bold tracking-widest text-on-surface-variant uppercase mb-2">
            <span>Network</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary">Suppliers</span>
          </nav>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface">Suppliers</h2>
          <p className="text-on-surface-variant mt-1 text-sm">{suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} in your network</p>
        </div>
        
        <div className="flex items-center gap-3">
          {canEdit && (
            <button
              onClick={() => setImportModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-on-surface-variant bg-surface-container-highest hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-lg">upload_file</span>
              Import
            </button>
          )}
          <button
            onClick={() => handleExport()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-on-surface-variant bg-surface-container-highest hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            Export
          </button>
          {canEdit && (
            <button onClick={() => setModal('new')}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-primary-container to-primary editorial-shadow active:scale-95 transition-transform">
              <span className="material-symbols-outlined text-lg">add</span>
              Add Supplier
            </button>
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="bg-secondary-container/20 text-on-secondary-container rounded-xl px-5 py-3.5 mb-6 flex items-center justify-between border border-secondary-container/50">
          <div className="flex items-center gap-3 font-semibold text-sm">
            <span className="material-symbols-outlined text-secondary">library_add_check</span>
            {selected.length} supplier(s) selected
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={() => handleExport()} className="px-4 py-2 bg-secondary text-white rounded-lg text-sm font-bold shadow hover:bg-secondary/90 transition-all active:scale-95">
              Export Selected
            </button>
            <button onClick={() => setSelected([])} className="px-4 py-2 bg-white text-on-surface-variant border border-outline-variant shadow-sm rounded-lg text-sm font-bold hover:bg-surface-container-low transition-colors">
              Clear
            </button>
            {canEdit && (
              <button 
                onClick={handleBulkDelete} 
                className="w-10 h-10 flex items-center justify-center bg-tertiary/10 text-tertiary rounded-lg hover:bg-tertiary hover:text-white transition-all active:scale-95"
                title="Delete Selected"
              >
                <span className="material-symbols-outlined">delete</span>
              </button>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-48 rounded-xl" />)}
        </div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-24">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 block">local_shipping</span>
          <p className="text-lg font-bold text-on-surface mb-1">No suppliers yet</p>
          <p className="text-sm text-on-surface-variant mb-6">Add your first supplier to link them to products</p>
          {canEdit && (
            <button onClick={() => setModal('new')}
              className="px-6 py-2.5 bg-gradient-to-br from-primary-container to-primary text-white rounded-xl text-sm font-semibold editorial-shadow">
              Add Supplier
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suppliers.map(supplier => (
            <div key={supplier.id} className="bg-surface-container-lowest rounded-xl editorial-shadow p-6 group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(supplier.id)}
                    onChange={() => toggleSelect(supplier.id)}
                    className="rounded border-outline-variant text-primary focus:ring-primary -mt-1"
                  />
                  <div className="w-12 h-12 rounded-xl bg-primary-fixed/30 flex items-center justify-center text-primary flex-shrink-0">
                    <span className="material-symbols-outlined text-2xl">local_shipping</span>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setModal(supplier)}
                      className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors">
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button onClick={() => { if (confirm(`Delete "${supplier.name}"?`)) deleteMutation.mutate(supplier.id) }}
                      className="p-1.5 rounded-lg text-tertiary hover:bg-tertiary-fixed/20 transition-colors">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                )}
              </div>

              <h3 className="text-base font-bold text-on-surface mb-1">{supplier.name}</h3>

              <div className="space-y-2 mt-3">
                {supplier.contact_email && (
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <span className="material-symbols-outlined text-[14px]">mail</span>
                    <a href={`mailto:${supplier.contact_email}`} className="hover:text-primary transition-colors truncate">
                      {supplier.contact_email}
                    </a>
                  </div>
                )}
                {supplier.phone && (
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <span className="material-symbols-outlined text-[14px]">call</span>
                    <span>{supplier.phone}</span>
                  </div>
                )}
                {supplier.address && (
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <span className="material-symbols-outlined text-[14px]">location_on</span>
                    <span className="truncate">{supplier.address}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-surface-container-low flex items-center justify-between">
                <div className="text-xs text-on-surface-variant">
                  Lead time: <span className="font-bold text-on-surface">{supplier.lead_time_days || 7} days</span>
                </div>
                <div className="text-xs text-on-surface-variant">
                  Products: <span className="font-bold text-on-surface">{supplier.products?.length || 0}</span>
                </div>
              </div>
              {supplier.notes && (
                <p className="text-xs text-on-surface-variant mt-3 italic leading-relaxed line-clamp-2">{supplier.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <SupplierModal
          supplier={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { qc.invalidateQueries(['suppliers']); setModal(null) }}
        />
      )}
      {importModal && (
        <SupplierImportModal
          onClose={() => setImportModal(false)}
          onImported={() => { qc.invalidateQueries(['suppliers']); setImportModal(false) }}
        />
      )}
    </div>
  )
}
