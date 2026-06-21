import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useEffect } from 'react'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import LineMap from './pages/LineMap'
import RouteManagement from './pages/RouteManagement'
import Drones from './pages/Drones'
import Tasks from './pages/Tasks'
import TaskDetail from './pages/TaskDetail'
import Defects from './pages/Defects'
import DefectDetail from './pages/DefectDetail'
import Alerts from './pages/Alerts'
import Replay from './pages/Replay'
import LogManagement from './pages/LogManagement'
import WorkOrders from './pages/WorkOrders'
import WorkOrderDetail from './pages/WorkOrderDetail'
import Analytics from './pages/Analytics'
import Accounts from './pages/Accounts'
import { canAccessPath, isAdmin } from './utils'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

function RoleProtectedRoute({
  children,
  path,
}: {
  children: React.ReactNode
  path: string
}) {
  const { user, isAuthenticated } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!canAccessPath(user, path)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function App() {
  const { isAuthenticated, fetchMe, user } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) {
      fetchMe()
    }
  }, [isAuthenticated, fetchMe])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route
          path="lines"
          element={
            <RoleProtectedRoute path="/lines">
              <LineMap />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="routes"
          element={
            <RoleProtectedRoute path="/routes">
              <RouteManagement />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="drones"
          element={
            <RoleProtectedRoute path="/drones">
              <Drones />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="tasks"
          element={
            <RoleProtectedRoute path="/tasks">
              <Tasks />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="tasks/:id"
          element={
            <RoleProtectedRoute path="/tasks">
              <TaskDetail />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="defects"
          element={
            <RoleProtectedRoute path="/defects">
              <Defects />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="defects/:id"
          element={
            <RoleProtectedRoute path="/defects">
              <DefectDetail />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="alerts"
          element={
            <RoleProtectedRoute path="/alerts">
              <Alerts />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="replay"
          element={
            <RoleProtectedRoute path="/replay">
              <Replay />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="logs"
          element={
            <RoleProtectedRoute path="/logs">
              <LogManagement />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="workorders"
          element={
            <RoleProtectedRoute path="/workorders">
              <WorkOrders />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="workorders/:id"
          element={
            <RoleProtectedRoute path="/workorders">
              <WorkOrderDetail />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="analytics"
          element={
            <RoleProtectedRoute path="/analytics">
              <Analytics />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="accounts"
          element={
            <RoleProtectedRoute path="/accounts">
              <Accounts />
            </RoleProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
