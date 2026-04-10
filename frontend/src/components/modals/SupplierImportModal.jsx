import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { importExportApi } from '../../services/api'

const STEPS = ['upload', 'mapping', 'preview', 'done']

const TARGET_FIELDS = [
  { key: 'name', label: 'Supplier Name', required: true, aliases: ['name', 'supplier', 'supplier_name', 'company', 'company_name'] },
  { key: 'contact_email', label: 'Contact Email', aliases: ['email', 'contact_email', 'contact email'] },
  { key: 'phone', label: 'Phone', aliases: ['phone', 'mobile', 'phone_number', 'contact_number', 'phone number', 'contact number'] },
  { key: 'address', label: 'Address', aliases: ['address', 'full_address', 'location'] },
  { key: 'lead_time_days', label: 'Lead Time (Days)', aliases: ['lead_time', 'lead_time_days', 'delivery_days', 'lead time days', 'lead time'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'remark', 'remarks', 'description'] },
]

export default function SupplierImportModal({ onClose, onImported }) {
  const [step, setStep] = useState('upload')
  const [file, setFile] = useState(null)
  const [mapping, setMapping] = useState({})
  const [headers, setHeaders] = useState([])
  const [preview, setPreview] = useState(null)
  const [errors, setErrors] = useState([])
  const [result, setResult] = useState(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  const previewMutation = useMutation({
    mutationFn: async (override) => {
      const fd = new FormData()
      fd.append('file', override?.file || file)
      fd.append('mapping', JSON.stringify(override?.mapping || mapping))
      fd.append('dry_run', 'true')
      return importExportApi.importSuppliers(fd)
    },
    onSuccess: (res) => {
      setPreview(res.data.preview)
      setErrors(res.data.errors || [])
      setStep('preview')
    },
    onError: () => toast.error('Preview failed'),
  })

  const importMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('mapping', JSON.stringify(mapping))
      return importExportApi.importSuppliers(fd)
    },
    onSuccess: (res) => {
      setResult(res.data)
      setStep('done')
    },
    onError: () => toast.error('Import failed'),
  })

  const handleFile = async (f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      return toast.error('Only CSV and Excel files supported')
    }
    setFile(f)

    if (ext === 'csv') {
      const text = await f.text()
      const firstLine = text.split('\n')[0]
      const hdrs = firstLine.split(',').map(h => h.replace(/"/g, '').trim()).filter(Boolean)
      setHeaders(hdrs)

      // Auto-mapping logic
      const newMap = {}
      let matchCount = 0
      TARGET_FIELDS.forEach(field => {
        const match = hdrs.find(h => {
           const norm = h.toLowerCase().trim().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, '_')
           return field.aliases.includes(norm) || field.aliases.includes(h.toLowerCase().trim())
        })
        if (match) {
           newMap[field.key] = match
           matchCount++
        }
      })
      
      setMapping(newMap)
      
      if (newMap.name && matchCount >= 3) {
         toast.success('Fields auto-mapped successfully!')
         previewMutation.mutate({ file: f, mapping: newMap })
         return
      } else if (newMap.name) {
         toast('Partial mapping found. Please review.', { icon: 'ℹ️'})
      } else {
         toast('No mapping found. Please map manually.', { icon: 'ℹ️'})
      }
    } else {
      setHeaders([])
    }
    setStep('mapping')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-editorial-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-surface-container-low flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-on-surface">Import Suppliers</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">CSV or Excel • Smart local auto-mapping</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-container-low transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-6 py-3 gap-2 flex-shrink-0 border-b border-surface-container-low">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                STEPS.indexOf(step) >= i ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'
              }`}>{i + 1}</div>
              <span className={`text-xs font-medium capitalize hidden sm:block ${
                step === s ? 'text-primary font-bold' : 'text-on-surface-variant'
              }`}>{s}</span>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-surface-container-high" />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6 scrollbar-thin">

          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer ${
                dragging ? 'border-primary bg-primary-fixed/10' : 'border-outline-variant hover:border-primary/50 hover:bg-surface-container-low'
              }`}
              onClick={() => fileRef.current?.click()}
            >
              <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 block">upload_file</span>
              <p className="text-base font-bold text-on-surface mb-1">Drop your file here</p>
              <p className="text-sm text-on-surface-variant mb-4">or click to browse</p>
              <p className="text-xs text-outline">Supports: .csv, .xlsx, .xls • Max 10MB</p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                onChange={e => handleFile(e.target.files[0])} />
            </div>
          )}

          {/* STEP 2: Mapping */}
          {step === 'mapping' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-bold text-on-surface">Column Mapping</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    File: <span className="font-mono text-primary">{file?.name}</span>
                  </p>
                </div>
                <button onClick={() => { setStep('upload'); setFile(null); setHeaders([]) }}
                  className="text-xs text-on-surface-variant hover:text-on-surface">
                  ← Change file
                </button>
              </div>

              {headers.length === 0 ? (
                <div className="bg-surface-container-low rounded-xl p-4 text-sm text-on-surface-variant text-center">
                  Excel file detected. Mapping will be applied on import.
                </div>
              ) : (
                <div className="space-y-3">
                  {TARGET_FIELDS.map(field => (
                    <div key={field.key} className="flex items-center gap-4">
                      <div className="w-36 flex-shrink-0">
                        <span className="text-xs font-bold text-on-surface">
                          {field.label}
                          {field.required && <span className="text-tertiary ml-0.5">*</span>}
                        </span>
                      </div>
                      <div className="flex-1">
                        <select
                          value={mapping[field.key] || ''}
                          onChange={e => setMapping({ ...mapping, [field.key]: e.target.value || undefined })}
                          className="w-full bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                        >
                          <option value="">— Skip field —</option>
                          {headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      {mapping[field.key] && (
                        <span className="material-symbols-outlined text-secondary text-[18px] flex-shrink-0">check_circle</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button onClick={() => previewMutation.mutate()}
                  disabled={previewMutation.isPending || (!mapping.name && headers.length > 0)}
                  className="flex-1 py-3 bg-gradient-to-br from-primary-container to-primary text-white rounded-xl text-sm font-semibold editorial-shadow hover:opacity-90 active:scale-95 transition-all disabled:opacity-50">
                  {previewMutation.isPending ? 'Analyzing...' : 'Preview Import →'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Preview */}
          {step === 'preview' && preview && (
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 bg-secondary-container/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-secondary">{previewMutation.data?.data?.valid_count || 0}</p>
                  <p className="text-xs text-on-surface-variant font-medium">Valid rows</p>
                </div>
                <div className="flex-1 bg-tertiary-fixed/30 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-tertiary">{previewMutation.data?.data?.error_count || 0}</p>
                  <p className="text-xs text-on-surface-variant font-medium">Error rows</p>
                </div>
              </div>

              {/* Preview table */}
              <div className="border border-surface-container-high rounded-xl overflow-hidden mb-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-container-low">
                      <tr>
                        {['Name', 'Email', 'Phone', 'Address', 'Lead Time'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-bold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-low">
                      {preview.slice(0, 8).map((row, i) => (
                        <tr key={i} className="hover:bg-surface-container-low/50">
                          <td className="px-3 py-2.5 font-medium text-on-surface truncate max-w-[150px]">{row.name}</td>
                          <td className="px-3 py-2.5 text-on-surface-variant truncate max-w-[120px]">{row.contact_email}</td>
                          <td className="px-3 py-2.5 text-on-surface whitespace-nowrap">{row.phone}</td>
                          <td className="px-3 py-2.5 text-on-surface-variant truncate max-w-[150px]">{row.address}</td>
                          <td className="px-3 py-2.5 text-on-surface">{row.lead_time_days ? `${row.lead_time_days} days` : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.length > 8 && (
                  <p className="text-xs text-on-surface-variant text-center py-2 border-t border-surface-container-low">
                    +{preview.length - 8} more rows
                  </p>
                )}
              </div>

              {errors.length > 0 && (
                <div className="bg-tertiary-fixed/20 rounded-xl p-4 mb-4">
                  <p className="text-xs font-bold text-tertiary mb-2">⚠️ {errors.length} rows will be skipped:</p>
                  {errors.slice(0, 3).map((e, i) => (
                    <p key={i} className="text-xs text-on-surface-variant">Row {e.row}: {e.errors?.join(', ')}</p>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep('mapping')}
                  className="px-6 py-3 bg-surface-container-highest rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container-high transition-colors">
                  ← Back
                </button>
                <button onClick={() => importMutation.mutate()}
                  disabled={importMutation.isPending}
                  className="flex-1 py-3 bg-gradient-to-br from-primary-container to-primary text-white rounded-xl text-sm font-semibold editorial-shadow hover:opacity-90 active:scale-95 transition-all disabled:opacity-50">
                  {importMutation.isPending ? 'Importing...' : `Import ${previewMutation.data?.data?.valid_count || 0} Suppliers`}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Done */}
          {step === 'done' && result && (
            <div className="text-center py-6">
              <div className="w-20 h-20 bg-secondary-container/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-4xl text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <h3 className="text-2xl font-bold text-on-surface mb-2">Import Complete!</h3>
              <p className="text-on-surface-variant mb-6">
                <span className="text-secondary font-bold text-xl">{result.imported_count}</span> suppliers imported successfully
                {result.error_count > 0 && (
                  <span className="text-tertiary"> · {result.error_count} skipped</span>
                )}
              </p>
              <div className="flex gap-3">
                <button onClick={onClose}
                  className="flex-1 py-3 bg-surface-container-highest rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container-high transition-colors">
                  Close
                </button>
                <button onClick={onImported}
                  className="flex-1 py-3 bg-gradient-to-br from-primary-container to-primary text-white rounded-xl text-sm font-semibold editorial-shadow hover:opacity-90 transition-all">
                  View Suppliers
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
