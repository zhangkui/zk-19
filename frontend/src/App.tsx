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
import WorkOrders from './pages/WorkOrders'
import WorkOrderDetail from './pages/WorkOrderDetail'
import Analytics from './pages/Analytics'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

function App() {
  const { isAuthenticated, fetchMe } = useAuthStore()

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
        <Route path="lines" element={<LineMap />} />
        <Route path="routes" element={<RouteManagement />} />
        <Route path="drones" element={<Drones />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="tasks/:id" element={<TaskDetail />} />
        <Route path="defects" element={<Defects />} />
        <Route path="defects/:id" element={<DefectDetail />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="replay" element={<Replay />} />
        <Route path="workorders" element={<WorkOrders />} />
        <Route path="workorders/:id" element={<WorkOrderDetail />} />
        <Route path="analytics" element={<Analytics />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
