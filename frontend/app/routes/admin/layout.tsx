import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { AppBar } from '~/components/admin/shell';
import { ApiError } from '~/lib/api';
import { useMe } from '~/lib/admin-api';
import { useAdminTheme } from '~/lib/admin-theme';

export default function AdminLayout() {
  useAdminTheme();
  const me = useMe();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) {
      navigate(`/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
    }
  }, [me.error, navigate, location.pathname, location.search]);

  if (!me.data) {
    return (
      <div className="min-h-dvh bg-ground" aria-busy="true">
        <div className="h-14 border-b border-line bg-surface sm:h-16" />
      </div>
    );
  }
  return (
    <div className="min-h-dvh bg-ground">
      <AppBar me={me.data} />
      <Outlet />
    </div>
  );
}
