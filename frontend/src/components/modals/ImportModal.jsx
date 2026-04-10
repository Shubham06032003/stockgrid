import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { importExportApi, aiApi } from '../../services/api'
import { formatCurrencyINR } from '../../utils/currency'

const STEPS = ['upload', 'mapping', 'preview', 'done']

const TARGET_FIELDS = [
  { key: 'name', label: 'Product Name', required: true },
  { key: 'sku', label: 'SKU' },
  { key: 'price', label: 'Price', required: true },
  { key: 'category', label: 'Category' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'min_stock', label: 'Min Stock' },
  { key: 'initial_stock', label: 'Initial Stock' },
  { key: 'description', label: 'Description' },
  { key: 'unit', label: 'Unit' },
]

function getErrorMessage(error) {
  if (!error) return 'Import failed for this row'
  if (error.message) return error.message
  if (Array.isArray(error.errors) && error.errors.length > 0) return error.errors.join(', ')
  return 'Import failed for this row'
}

export default function ImportModal({ onClose, onImported }) {
  const [step, setStep] = useState('upload')
  const [file, setFile] = useState(null)
  const [mapping, setMapping] = useState({})
  const [headers, setHeaders] = useState([])
  const [preview, setPreview] = useState(null)
  const [errors, setErrors] = useState([])
  const [result, setResult] = useState(null)
  const [previewStats, setPreviewStats] = useState({ valid_count: 0, error_count: 0 })
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  const previewMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('mapping', JSON.stringify(mapping))
      fd.append('dry_run', 'true')
      return importExportApi.importPreview(fd)
    },
    onSuccess: (res) => {
      setPreview(res.data.preview)
      setErrors(res.data.errors || [])
      setPreviewStats({
        valid_count: res.data.valid_count || 0,
        error_count: res.data.error_count || 0,
      })
      setStep('preview')
    },
    onError: (error) => {
      const message = error?.response?.data?.error || error?.message || 'Preview failed'
      toast.error(message)
    },
  })

  const importMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('mapping', JSON.stringify(mapping))
      return importExportApi.import(fd)
    },
    onSuccess: (res) => {
      setResult(res.data)
      setStep('done')
    },
    onError: (error) => {
      const message = error?.response?.data?.error || error?.message || 'Import failed'
      toast.error(message)
    },
  })

  const aiMapMutation = useMutation({
    mutationFn: async (hdrs) => aiApi.columnMap(hdrs, []),
    onSuccess: (res) => {
      setMapping(res.data.mapping || {})
      toast.success('AI mapped your columns!')
    },
    onError: () => toast('Could not auto-map. Please map manually.', { icon: 'i' }),
  })

  const handleFile = async (f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      return toast.error('Only CSV and Excel files supported')
    }

    setFile(f)
    setResult(null)
    setPreview(null)
    setErrors([])
    setPreviewStats({ valid_count: 0, error_count: 0 })

    if (ext === 'csv') {
      const text = await f.text()
      const firstLine = text.split('\n')[0]
      const hdrs = firstLine.split(',').map((h) => h.replace(/"/g, '').trim()).filter(Boolean)
      setHeaders(hdrs)
      aiMapMutation.mutate(hdrs)
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

  const previewValidCount = previewStats.valid_count || 0
  const finalErrors = result?.errors || []
  const supplierWarnings = result?.supplier_warnings || []
  const importFailedCompletely = result && result.imported_count === 0 && result.error_count > 0
  const hasPartialFailure = result && result.imported_count > 0 && result.error_count > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-editorial-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b border-surface-container-low flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-on-surface">Import Products</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">CSV or Excel - AI-powered column detection</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-container-low transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>

        <div className="flex px-6 py-3 gap-2 flex-shrink-0 border-b border-surface-container-low">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  STEPS.indexOf(step) >= i ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`text-xs font-medium capitalize hidden sm:block ${
                  step === s ? 'text-primary font-bold' : 'text-on-surface-variant'
                }`}
              >
                {s}
              </span>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-surface-container-high" />}
            </div>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-6 scrollbar-thin">
          {step === 'upload' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
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
              <p className="text-xs text-outline">Supports: .csv, .xlsx, .xls - Max 10MB</p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
            </div>
          )}

          {step === 'mapping' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-bold text-on-surface">Column Mapping</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    File: <span className="font-mono text-primary">{file?.name}</span>
                    {aiMapMutation.isPending && <span className="ml-2 text-primary">AI detecting columns...</span>}
                  </p>
                </div>
                <button
                  onClick={() => { setStep('upload'); setFile(null); setHeaders([]) }}
                  className="text-xs text-on-surface-variant hover:text-on-surface"
                >
                  Change file
                </button>
              </div>

              {headers.length === 0 ? (
                <div className="bg-surface-container-low rounded-xl p-4 text-sm text-on-surface-variant text-center">
                  Excel file detected. Mapping will be applied on import.
                </div>
              ) : (
                <div className="space-y-3">
                  {TARGET_FIELDS.map((field) => (
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
                          onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value || undefined })}
                          className="w-full bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                        >
                          <option value="">- Skip field -</option>
                          {headers.map((h) => <option key={h} value={h}>{h}</option>)}
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
                <button
                  onClick={() => previewMutation.mutate()}
                  disabled={previewMutation.isPending || (!mapping.name && headers.length > 0)}
                  className="flex-1 py-3 bg-gradient-to-br from-primary-container to-primary text-white rounded-xl text-sm font-semibold editorial-shadow hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                >
                  {previewMutation.isPending ? 'Analyzing...' : 'Preview Import'}
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && preview && (
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 bg-secondary-container/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-secondary">{previewValidCount}</p>
                  <p className="text-xs text-on-surface-variant font-medium">Valid rows</p>
                </div>
                <div className="flex-1 bg-tertiary-fixed/30 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-tertiary">{previewStats.error_count || 0}</p>
                  <p className="text-xs text-on-surface-variant font-medium">Error rows</p>
                </div>
              </div>

              <div className="border border-surface-container-high rounded-xl overflow-hidden mb-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-container-low">
                      <tr>
                        {['Name', 'SKU', 'Price', 'Category', 'Stock'].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left font-bold text-on-surface-variant uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-low">
                      {preview.slice(0, 8).map((row, i) => (
                        <tr key={`${row.row_number || i}-${row.sku || row.name || i}`} className="hover:bg-surface-container-low/50">
                          <td className="px-3 py-2.5 font-medium text-on-surface truncate max-w-[150px]">{row.name}</td>
                          <td className="px-3 py-2.5 font-mono text-on-surface-variant">{row.sku}</td>
                          <td className="px-3 py-2.5 text-on-surface">{formatCurrencyINR(row.price)}</td>
                          <td className="px-3 py-2.5 text-on-surface-variant">{row.category}</td>
                          <td className="px-3 py-2.5 text-on-surface">{row.initial_stock}</td>
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
                  <p className="text-xs font-bold text-tertiary mb-2">Warning: {errors.length} rows will be skipped</p>
                  {errors.slice(0, 3).map((error, index) => (
                    <p key={`${error.row || index}-${index}`} className="text-xs text-on-surface-variant">
                      Row {error.row}: {getErrorMessage(error)}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('mapping')}
                  className="px-6 py-3 bg-surface-container-highest rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => importMutation.mutate()}
                  disabled={importMutation.isPending}
                  className="flex-1 py-3 bg-gradient-to-br from-primary-container to-primary text-white rounded-xl text-sm font-semibold editorial-shadow hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                >
                  {importMutation.isPending ? 'Importing...' : `Import ${previewValidCount} Products`}
                </button>
              </div>
            </div>
          )}

          {step === 'done' && result && (
            <div className="py-6">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
                importFailedCompletely ? 'bg-tertiary-fixed/30' : 'bg-secondary-container/30'
              }`}>
                <span
                  className={`material-symbols-outlined text-4xl ${importFailedCompletely ? 'text-tertiary' : 'text-secondary'}`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {importFailedCompletely ? 'error' : 'check_circle'}
                </span>
              </div>

              <h3 className="text-2xl font-bold text-on-surface mb-2 text-center">
                {importFailedCompletely ? 'Import Failed' : hasPartialFailure ? 'Import Finished with Issues' : 'Import Complete!'}
              </h3>
              <p className="text-on-surface-variant mb-6 text-center">
                <span className={`font-bold text-xl ${importFailedCompletely ? 'text-tertiary' : 'text-secondary'}`}>
                  {result.imported_count}
                </span>{' '}
                products imported successfully
                {result.error_count > 0 && (
                  <span className="text-tertiary"> - {result.error_count} skipped</span>
                )}
              </p>

              {(result.import_summary || previewValidCount > 0) && (
                <div className="bg-surface-container-low rounded-xl p-4 mb-4 text-sm text-on-surface-variant">
                  <p>{result.import_summary || `Preview showed ${previewValidCount} valid row(s) before final import.`}</p>
                  {previewValidCount > 0 && (
                    <p className="mt-1 text-xs">
                      Preview valid rows: <span className="font-semibold text-on-surface">{previewValidCount}</span>
                    </p>
                  )}
                </div>
              )}

              {supplierWarnings.length > 0 && (
                <div className="bg-amber-100/70 rounded-xl p-4 mb-4">
                  <p className="text-xs font-bold text-amber-700 mb-2">Supplier warnings</p>
                  {supplierWarnings.slice(0, 3).map((warning, index) => (
                    <p key={`${warning}-${index}`} className="text-xs text-amber-800">{warning}</p>
                  ))}
                </div>
              )}

              {finalErrors.length > 0 && (
                <div className="bg-tertiary-fixed/20 rounded-xl p-4 mb-6">
                  <p className="text-xs font-bold text-tertiary mb-2">Import issues</p>
                  <div className="space-y-2">
                    {finalErrors.slice(0, 5).map((error, index) => (
                      <div key={`${error.row || index}-${error.final_sku || error.original_sku || index}`} className="text-xs text-on-surface-variant">
                        <span className="font-semibold text-on-surface">
                          Row {error.row || '-'}
                          {error.product_name ? ` - ${error.product_name}` : ''}
                        </span>
                        <span>: {getErrorMessage(error)}</span>
                        {error.final_sku && (
                          <span className="block mt-0.5 font-mono text-[11px] text-on-surface-variant">SKU: {error.final_sku}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={importFailedCompletely ? () => setStep('mapping') : onClose}
                  className="flex-1 py-3 bg-surface-container-highest rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  {importFailedCompletely ? 'Back to Mapping' : 'Close'}
                </button>
                {result.imported_count > 0 ? (
                  <button
                    onClick={onImported}
                    className="flex-1 py-3 bg-gradient-to-br from-primary-container to-primary text-white rounded-xl text-sm font-semibold editorial-shadow hover:opacity-90 transition-all"
                  >
                    View Products
                  </button>
                ) : (
                  <button
                    onClick={() => setStep('mapping')}
                    className="flex-1 py-3 bg-gradient-to-br from-primary-container to-primary text-white rounded-xl text-sm font-semibold editorial-shadow hover:opacity-90 transition-all"
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
