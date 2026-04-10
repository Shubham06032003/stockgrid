import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { authApi } from '../services/api'
import { useAuthStore } from '../store/authStore'

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', organizationName: '' })
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: () => authApi.register(form),
    onSuccess: (res) => {
      login(res.data.user, res.data.token)
      toast.success('Workspace created! Welcome aboard.')
      navigate('/')
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Registration failed')
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-12 h-12 rounded-2xl bg-primary-container flex items-center justify-center text-white shadow-editorial">
            <span className="material-symbols-outlined text-2xl">inventory_2</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">StockGrid</h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Inventory Intelligence</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-editorial p-8">
          <h2 className="text-2xl font-bold text-on-surface mb-1">Create your workspace</h2>
          <p className="text-sm text-on-surface-variant mb-8">Set up your inventory management system</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { key: 'organizationName', label: 'Company Name', type: 'text', placeholder: 'Acme Corp' },
              { key: 'name', label: 'Your Name', type: 'text', placeholder: 'Alex Rivera' },
              { key: 'email', label: 'Work Email', type: 'email', placeholder: 'you@company.com' },
              { key: 'password', label: 'Password', type: 'password', placeholder: '8+ characters' },
            ].map(field => (
              <div key={field.key}>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                  {field.label}
                </label>
                <input
                  type={field.type}
                  required
                  value={form[field.key]}
                  onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-gradient-to-br from-primary-container to-primary text-white py-3 rounded-xl font-semibold text-sm shadow-editorial hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 mt-2"
            >
              {mutation.isPending ? 'Creating workspace...' : 'Create Workspace'}
            </button>
          </form>

          <p className="text-center text-sm text-on-surface-variant mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
