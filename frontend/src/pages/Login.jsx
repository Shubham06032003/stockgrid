import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { authApi } from '../services/api'
import { useAuthStore } from '../store/authStore'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: () => authApi.login(form),
    onSuccess: (res) => {
      login(res.data.user, res.data.token)
      toast.success(`Welcome back, ${res.data.user.name}!`)
      navigate('/')
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Login failed')
    }
  })

  const forgotPasswordMutation = useMutation({
    mutationFn: () => authApi.forgotPassword({ email: resetEmail }),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'If your account exists, a reset link has been sent')
      setShowForgotPassword(false)
      setResetEmail('')
    },
    onError: (err) => {
      const firstValidationError = err.response?.data?.errors?.[0]?.msg
      toast.error(firstValidationError || err.response?.data?.error || 'Could not send reset email')
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate()
  }

  const handleForgotPasswordSubmit = (e) => {
    e.preventDefault()
    forgotPasswordMutation.mutate()
  }

  const toggleForgotPassword = () => {
    setShowForgotPassword((current) => !current)
    setResetEmail((current) => current || form.email)
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
          <h2 className="text-2xl font-bold text-on-surface mb-1">Welcome back</h2>
          <p className="text-sm text-on-surface-variant mb-8">Sign in to your inventory workspace</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                placeholder="Enter your password"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={toggleForgotPassword}
                className="text-sm font-semibold text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-gradient-to-br from-primary-container to-primary text-white py-3 rounded-xl font-semibold text-sm shadow-editorial hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
            >
              {mutation.isPending ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {showForgotPassword && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-base font-bold text-slate-900 mb-1">Reset password</h3>
              <p className="text-sm text-slate-600 mb-4">Enter your email and we will send you a secure password reset link.</p>

              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Email</label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                    placeholder="you@company.com"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="flex-1 rounded-xl bg-white border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotPasswordMutation.isPending}
                    className="flex-1 bg-gradient-to-br from-primary-container to-primary text-white py-3 rounded-xl font-semibold text-sm shadow-editorial hover:opacity-90 transition-all disabled:opacity-60"
                  >
                    {forgotPasswordMutation.isPending ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <p className="text-center text-sm text-on-surface-variant mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary font-semibold hover:underline">
              Create workspace
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
