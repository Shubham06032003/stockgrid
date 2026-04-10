import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { authApi } from '../services/api'
import { useAuthStore } from '../store/authStore'

export default function Settings() {
  const { user, updateUser } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()

  const [profileForm, setProfileForm] = useState({ name: user?.name || '' })
  const [passwordForm, setPasswordForm] = useState({ current: '', password: '' })
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'staff', password: '' })
  const [activeTab, setActiveTab] = useState('profile')

  const inviteMutation = useMutation({
    mutationFn: () => authApi.invite(inviteForm),
    onSuccess: () => {
      toast.success(`${inviteForm.name} has been added to your workspace!`)
      setInviteForm({ name: '', email: '', role: 'staff', password: '' })
      queryClient.invalidateQueries({ queryKey: ['team'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Invite failed'),
  })

  const { data: teamData, isLoading: isTeamLoading, isError: isTeamError, refetch: refetchTeam } = useQuery({
    queryKey: ['team'],
    queryFn: () => authApi.team().then(r => r.data),
    enabled: activeTab === 'team' && isAdmin
  })

  const reactivateMutation = useMutation({
    mutationFn: (id) => authApi.reactivate(id),
    onSuccess: () => { toast.success('User reactivated successfully!'); refetchTeam() },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to reactivate')
  })

  const deactivateMutation = useMutation({
    mutationFn: (id) => authApi.deactivate(id),
    onSuccess: () => { toast.success('User deactivated successfully'); refetchTeam() },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to deactivate')
  })

  const TABS = [
    { key: 'profile', label: 'Profile', icon: 'person' },
    { key: 'team', label: 'Team', icon: 'group', adminOnly: true },
    { key: 'about', label: 'About', icon: 'info' },
  ].filter(t => !t.adminOnly || isAdmin)

  const getReactivationDaysLeft = (deactivatedAt) => {
    if (!deactivatedAt) return null
    const cutoff = new Date(deactivatedAt).getTime() + (45 * 24 * 60 * 60 * 1000)
    const remaining = cutoff - Date.now()
    if (remaining <= 0) return 0
    return Math.ceil(remaining / (24 * 60 * 60 * 1000))
  }

  return (
    <div className="px-8 py-8 max-w-3xl">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-on-surface">Settings</h2>
        <p className="text-on-surface-variant mt-1 text-sm">Manage your profile and workspace</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-surface-container-low rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === t.key
                ? 'bg-surface-container-highest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}>
            <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-6">
            <h3 className="font-bold text-on-surface mb-5">Profile Information</h3>

            {/* Avatar */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-primary-container flex items-center justify-center text-white text-2xl font-bold">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-on-surface">{user?.name}</p>
                <p className="text-sm text-on-surface-variant">{user?.email}</p>
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-primary-fixed/30 text-primary text-[10px] font-bold uppercase tracking-wider">
                  {user?.role}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Display Name</label>
                <input value={profileForm.name} onChange={e => setProfileForm({ name: e.target.value })}
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Email Address</label>
                <input value={user?.email} readOnly
                  className="w-full bg-surface-container border-none rounded-xl px-4 py-2.5 text-sm outline-none text-on-surface-variant cursor-not-allowed" />
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => { updateUser({ name: profileForm.name }); toast.success('Profile updated!') }}
                className="px-6 py-2.5 bg-gradient-to-br from-primary-container to-primary text-white rounded-xl text-sm font-semibold editorial-shadow hover:opacity-90 active:scale-95 transition-all">
                Save Changes
              </button>
            </div>
          </div>

          {/* Password section */}
          <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-6">
            <h3 className="font-bold text-on-surface mb-5">Change Password</h3>
            <div className="space-y-4">
              {[
                { key: 'current', label: 'Current Password' },
                { key: 'password', label: 'New Password' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">{f.label}</label>
                  <input type="password" value={passwordForm[f.key]}
                    onChange={e => setPasswordForm({ ...passwordForm, [f.key]: e.target.value })}
                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                    placeholder="••••••••" />
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => toast('Password change requires re-authentication. Feature coming soon.', { icon: 'ℹ️' })}
                className="px-6 py-2.5 bg-surface-container-highest text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors">
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Tab */}
      {activeTab === 'team' && isAdmin && (
        <div className="space-y-6">
          <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-6">
            <h3 className="font-bold text-on-surface mb-1">Invite Team Member</h3>
            <p className="text-xs text-on-surface-variant mb-5">Add managers and staff to your workspace</p>

            <form onSubmit={e => { e.preventDefault(); inviteMutation.mutate() }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Full Name *</label>
                  <input required value={inviteForm.name} onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })}
                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                    placeholder="Jane Smith" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Role *</label>
                  <select value={inviteForm.role} onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm focus:ring-0 outline-none">
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Email *</label>
                  <input required type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                    placeholder="jane@company.com" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Temp Password *</label>
                  <input required value={inviteForm.password} onChange={e => setInviteForm({ ...inviteForm, password: e.target.value })}
                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                    placeholder="They should change this" />
                </div>
              </div>

              <div className="bg-primary-fixed/20 rounded-xl p-3 text-xs text-on-surface-variant">
                <strong>Role permissions:</strong><br />
                <span className="font-semibold">Staff</span> — Can view and record stock movements<br />
                <span className="font-semibold">Manager</span> — Can add/edit products and suppliers<br />
                <span className="font-semibold">Admin</span> — Full access including deletion and team management
              </div>

              <div className="flex justify-end">
                <button type="submit" disabled={inviteMutation.isPending}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-br from-primary-container to-primary text-white rounded-xl text-sm font-semibold editorial-shadow hover:opacity-90 active:scale-95 transition-all disabled:opacity-60">
                  <span className="material-symbols-outlined text-[18px]">person_add</span>
                  {inviteMutation.isPending ? 'Adding...' : 'Add Team Member'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl editorial-shadow overflow-hidden">
            <h3 className="font-bold text-on-surface p-6 pb-2">Team Members</h3>
            <div className="divide-y divide-surface-container-low border-t border-surface-container-low mt-4">
              {isTeamLoading && (
                <div className="p-6 text-center text-sm text-on-surface-variant">Loading team members...</div>
              )}
              {isTeamError && (
                <div className="p-6 text-center text-sm text-tertiary">Could not load team members. Please try again.</div>
              )}
              {teamData?.team?.map(member => (
                <div key={member.id} className="p-6 flex items-center justify-between hover:bg-surface-container-low/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary font-bold">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-on-surface flex items-center gap-2">
                        {member.name}
                        {!member.is_active && <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed/30 text-tertiary text-[10px] uppercase font-bold tracking-wider">Deactivated</span>}
                      </p>
                      <p className="text-xs text-on-surface-variant font-mono">{member.email} · {member.role}</p>
                      {!member.is_active && member.deactivated_at && (
                        <>
                          <p className="text-[10px] text-tertiary mt-1 font-medium">
                            Deactivated on {new Date(member.deactivated_at).toLocaleDateString()}
                          </p>
                          <p className="text-[10px] text-on-surface-variant mt-1">
                            {getReactivationDaysLeft(member.deactivated_at) > 0
                              ? `${getReactivationDaysLeft(member.deactivated_at)} day(s) left to reactivate`
                              : 'Reactivation window expired'}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {member.id !== user.id && member.is_active && (
                      <button onClick={() => deactivateMutation.mutate(member.id)} disabled={deactivateMutation.isPending}
                        className="px-3 py-1.5 bg-surface-container text-tertiary rounded-lg text-xs font-semibold hover:bg-tertiary hover:text-white transition-colors">
                        Deactivate
                      </button>
                    )}
                    {!member.is_active && (
                      <button onClick={() => reactivateMutation.mutate(member.id)} disabled={reactivateMutation.isPending}
                        className="px-3 py-1.5 bg-secondary-container/30 text-secondary rounded-lg text-xs font-semibold hover:bg-secondary hover:text-white transition-colors">
                        Reactivate
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!isTeamLoading && !isTeamError && !teamData?.team?.length && (
                <div className="p-6 text-center text-sm text-on-surface-variant">No team members found</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* About Tab */}
      {activeTab === 'about' && (
        <div className="space-y-6">
          <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-primary-container flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-3xl">inventory_2</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-on-surface">StockGrid</h3>
                <p className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">Inventory Intelligence</p>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              {[
                { label: 'Version', value: '1.0.0' },
                { label: 'AI Engine', value: 'Google Gemini 2.0 Flash Lite' },
                { label: 'Database', value: 'PostgreSQL via Supabase' },
                { label: 'Frontend', value: 'React + Vite + Tailwind CSS' },
                { label: 'Backend', value: 'Node.js + Express' },
                { label: 'Your Role', value: user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1) },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-surface-container-low last:border-0">
                  <span className="text-on-surface-variant font-medium">{item.label}</span>
                  <span className="font-semibold text-on-surface">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-surface-container-low rounded-xl text-xs text-on-surface-variant leading-relaxed">
              <strong className="text-on-surface">Architecture Note:</strong> Stock levels are never stored directly — they are always calculated as the sum of IN transactions minus OUT transactions. This ensures a complete, auditable history of all inventory movements.
            </div>
          </div>

          {/* Danger Zone */}
          {isAdmin && (
            <div className="bg-primary-fixed/10 border border-primary/20 rounded-2xl p-6">
              <div className="flex items-center gap-2 text-primary mb-4">
                <span className="material-symbols-outlined text-[20px]">warning</span>
                <h3 className="font-bold">Danger Zone</h3>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-on-surface text-sm">Delete Workspace</p>
                  <p className="text-xs text-on-surface-variant mt-1 max-w-[400px]">
                    Permanently delete this organization and all associated data. This action is irreversible.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const confirmName = window.prompt("Type 'DELETE' to confirm permanent workspace deletion.");
                    if (confirmName === 'DELETE') {
                      authApi.deleteOrganization()
                        .then(() => {
                          toast.success('Workspace deleted. Goodbye!');
                          setTimeout(() => {
                             useAuthStore.getState().logout();
                             window.location.href = '/login';
                          }, 2000);
                        })
                        .catch(err => toast.error(err.response?.data?.error || 'Deletion failed'));
                    }
                  }}
                  className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold editorial-shadow hover:bg-primary/90 transition-all"
                >
                  Delete Workspace
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
