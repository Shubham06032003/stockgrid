import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  timeout: 30000,
})

// Request interceptor: attach token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
    }
    return Promise.reject(error)
  }
)

export default api

// Auth
export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  me: () => api.get('/auth/me'),
  invite: (data) => api.post('/auth/invite', data),
  team: () => api.get('/auth/team'),
  reactivate: (id) => api.patch(`/auth/reactivate/${id}`),
  deactivate: (id) => api.patch(`/auth/deactivate/${id}`),
  deleteOrganization: () => api.delete('/auth/organization'),
}

// Products
export const productsApi = {
  list: (params) => api.get('/products', { params }),
  get: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  bulkDelete: (ids) => api.post('/products/bulk-delete', { ids }),
  categories: () => api.get('/products/meta/categories'),
}

// Transactions
export const transactionsApi = {
  list: (params) => api.get('/transactions', { params }),
  create: (data) => api.post('/transactions', data),
  summary: (params) => api.get('/transactions/summary', { params }),
}

// Suppliers
export const suppliersApi = {
  list: () => api.get('/suppliers'),
  get: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`),
  bulkDelete: (ids) => api.post('/suppliers/bulk-delete', { ids }),
}

// Reports
export const reportsApi = {
  dashboard: () => api.get('/reports/dashboard'),
  valuation: () => api.get('/reports/inventory-valuation'),
  topProducts: (params) => api.get('/reports/top-products', { params }),
  deadStock: (params) => api.get('/reports/dead-stock', { params }),
}

// AI
export const aiApi = {
  chat: (messages) => api.post('/ai/chat', { messages }),
  predict: (product_id) => api.post('/ai/predict', { product_id }),
  reorderSuggestions: () => api.post('/ai/reorder-suggestions'),
  deadStock: (days) => api.post('/ai/dead-stock', { days }),
  columnMap: (headers, sample_data) => api.post('/ai/column-map', { headers, sample_data }),
  generateSKU: (name, category) => api.post('/ai/generate-sku', { name, category }),
  dashboardInsights: (data) => api.post('/ai/dashboard-insights', { dashboard_data: data }),
}

// Import / Export
export const importExportApi = {
  import: (formData) => api.post('/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  }),
  importPreview: (formData) => api.post('/import?dry_run=true', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  }),
  exportProducts: (format) => api.get(`/export/products?format=${format}`, { responseType: 'blob' }),
  exportTransactions: (params) => api.get('/export/transactions', { params, responseType: 'blob' }),
  importSuppliers: (formData) => api.post('/import/suppliers', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  exportSuppliers: (params) => api.get('/export/suppliers', { params, responseType: 'blob' }),
}

// Alerts
export const alertsApi = {
  list: (params) => api.get('/alerts', { params }),
  resolve: (id) => api.patch(`/alerts/${id}/resolve`),
}
