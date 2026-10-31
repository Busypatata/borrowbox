import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';

function Loading() {
  return (
    <div className="container-page space-y-4 py-10" aria-busy="true">
      <Skeleton className="h-10 w-1/3" /><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" />
    </div>
  );
}

export function RequireAuth() {
  const { user, isLoading, error, refetch } = useAuth();
  const location = useLocation();
  if (isLoading) return <Loading />;
  if (error) return <div className="container-page py-10"><ErrorState error={error} onRetry={() => void refetch()} /></div>;
  if (!user) {
    // Preserve the intended destination so login can send the user back.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

export function RequireAdmin() {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** Login/signup pages bounce signed-in users to the dashboard. */
export function GuestOnly() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Loading />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
