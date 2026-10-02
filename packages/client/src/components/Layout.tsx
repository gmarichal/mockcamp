import { Outlet, NavLink, useParams } from 'react-router-dom'
import {
  LayoutGrid, ScrollText, Users, Settings,
  FolderTree, Layers, Variable, LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

export function Layout() {
  const { projectId } = useParams()
  const { user, logout } = useAuth()

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Topbar */}
      <header
        style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}
        className="flex items-center justify-between px-4 h-11 flex-shrink-0"
      >
        <div className="flex items-center gap-2">
          {/* Logo */}
          <div
            className="flex items-center justify-center rounded"
            style={{ width: 22, height: 22, background: 'var(--accent)' }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 4h9M2 7h6M2 10h4" stroke="#0F1117" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Mock<span style={{ color: 'var(--accent)' }}>Camp</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>v0.1.0</span>
          <div
            className="flex items-center justify-center rounded-full text-xs font-semibold"
            title={user?.email}
            style={{
              width: 26, height: 26,
              background: 'var(--accent-dim)',
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
            }}
          >
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="flex items-center justify-center rounded-md p-1.5 transition-colors"
            style={{ color: 'var(--text-muted)', border: '1px solid transparent' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = 'var(--error)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--error)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'transparent'
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside
          style={{ width: 200, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}
          className="flex flex-col flex-shrink-0 overflow-y-auto py-3"
        >
          <SidebarSection label="Navigation">
            <SidebarItem to="/projects" icon={<LayoutGrid size={14} />} label="Projects" />
          </SidebarSection>

          {projectId && (
            <>
              <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
              <SidebarSection label="Current project">
                <SidebarItem to={`/projects/${projectId}/paths`}     icon={<FolderTree size={14} />} label="Paths" />
                <SidebarItem to={`/projects/${projectId}/resources`}  icon={<Layers size={14} />}    label="Resources" />
                <SidebarItem to={`/projects/${projectId}/variables`}  icon={<Variable size={14} />}  label="Variables" />
                <SidebarItem to={`/projects/${projectId}/logs`}       icon={<ScrollText size={14} />} label="Logs" />
              </SidebarSection>
            </>
          )}

          <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
          <SidebarSection label="Admin">
            <SidebarItem to="/users" icon={<Users size={14} />} label="Users" />
            <SidebarItem to="/settings" icon={<Settings size={14} />} label="Settings" />
          </SidebarSection>
        </aside>

        {/* Main content */}
        <main
          style={{ background: 'var(--bg-base)' }}
          className="flex-1 overflow-y-auto p-5"
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-2 mb-1">
      <p
        className="text-[10px] font-semibold uppercase tracking-widest px-2 pb-1.5"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </p>
      {children}
    </div>
  )
}

function SidebarItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
          isActive
            ? 'text-accent bg-[rgba(62,207,207,0.1)]'
            : 'text-txt-secondary hover:text-txt-primary hover:bg-[var(--bg-hover)]',
        )
      }
      style={({ isActive }) => ({
        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
      })}
    >
      <span style={{ opacity: 0.8 }}>{icon}</span>
      {label}
    </NavLink>
  )
}
