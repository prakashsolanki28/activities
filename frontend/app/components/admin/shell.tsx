import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Users } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';
import { CoBrand } from '~/components/brand';
import { adminApi, type Me } from '~/lib/admin-api';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/** The app bar every admin screen shares: HRRL and CISO Office marks with the product name, account on the right. */
export function AppBar({ me }: { me: Me }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => {
    await adminApi.logout().catch(() => undefined);
    qc.clear();
    navigate('/admin/login', { replace: true });
  };
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <div className="flex h-14 items-center gap-4 px-4 sm:h-16 sm:px-6">
        <Link to="/admin" className="flex min-w-0 items-center gap-3 rounded-sm outline-offset-4" aria-label="HRRL Activities home">
          <CoBrand />
          <span className="hidden h-8 w-px bg-line-strong md:block" aria-hidden />
          <span className="hidden text-[15px] font-semibold tracking-[-0.005em] text-ink md:inline">Activities</span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger className="ml-auto grid size-8 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold text-white outline-offset-2 hover:bg-brand-hover" aria-label={`Account: ${me.name}`}>
            {initials(me.name)}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <span className="block text-sm font-semibold text-ink">{me.name}</span>
              <span className="block text-xs text-ink-3">{me.email}</span>
              <span className="mt-0.5 block text-xs text-ink-3">{me.role === 'owner' ? 'Owner' : 'Editor'}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/admin/admins')}>
              <Users /> Manage admins
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={signOut}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
