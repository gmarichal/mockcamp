import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/components/AuthProvider'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Layout } from '@/components/Layout'
import { LoginPage } from '@/pages/LoginPage'
import { ChangePasswordPage } from '@/pages/ChangePasswordPage'
import { ProjectsPage } from '@/pages/ProjectsPage'
import { PathsPage } from '@/pages/PathsPage'
import { ResourcesPage } from '@/pages/ResourcesPage'
import { VariablesPage } from '@/pages/VariablesPage'
import { LogsPage } from '@/pages/LogsPage'

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-muted)' }}>
      {label} — coming soon
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Forces password change before anything else */}
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />

        {/* Protected app */}
        <Route
          element={
            <ProtectedRoute requirePasswordChanged>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId/paths"     element={<PathsPage />} />
          <Route path="/projects/:projectId/resources"  element={<ResourcesPage />} />
          <Route path="/projects/:projectId/variables"  element={<VariablesPage />} />
          <Route path="/projects/:projectId/logs"       element={<LogsPage />} />
          <Route path="/users"    element={<ComingSoon label="Users" />} />
          <Route path="/settings" element={<ComingSoon label="Settings" />} />
        </Route>

        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </AuthProvider>
  )
}
