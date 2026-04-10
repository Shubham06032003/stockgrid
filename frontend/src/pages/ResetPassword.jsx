import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { authApi } from '../services/api'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' })

  const hasToken = useMemo(() => Boolean(token), [token])

  const mutation = useMutation({
    mutationFn: () => authApi.resetPassword({ token, ...form }),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Password updated successfully')
      navigate('/login')
    },
    onError: (err) => {
      const firstValidationError = err.response?.data?.errors?.[0]?.msg
      toast.error(firstValidationError || err.response?.data?.error || 'Could not reset password')
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-editorial p-8">
          <h1 className="text-2xl font-bold text-on-surface mb-1">Set a new password</h1>
          <p className="text-sm text-on-surface-variant mb-8">Choose a strong password for your account.</p>

          {!hasToken ? (
            <div className="rounded-2xl border border-tertiary/20 bg-tertiary-fixed/10 p-5">
              <p className="text-sm text-tertiary font-medium">This reset link is invalid or incomplete.</p>
              <Link to="/login" className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline">
                Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.newPassword}
                  onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                  placeholder="Minimum 8 characters"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Confirm Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                  placeholder="Re-enter your new password"
                />
              </div>

              <button
                type="submit"
                disabled={mutation.isPending}
                className="w-full bg-gradient-to-br from-primary-container to-primary text-white py-3 rounded-xl font-semibold text-sm shadow-editorial hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
              >
                {mutation.isPending ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-on-surface-variant mt-6">
            Remembered it?{' '}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
