import { Navigate, Outlet } from 'react-router'
import { homeFor, useAuth, type Role } from '../store/auth'

// Opens the screens inside it only for the right kind of account; anyone else is sent where they belong.
export function RequireRole({ role }: { role: Role }) {
  const user = useAuth((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to={homeFor(user.role)} replace />
  return <Outlet />
}