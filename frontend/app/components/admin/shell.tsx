import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Users } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';
import { adminApi, type Me } from '~/lib/admin-api';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/** The app bar every admin screen shares: product name on the left, account on the right. */
export function AppBar({ me }: { me: Me }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => {
    await adminApi.logout().catch(() => undefined);
    qc.clear();
    navigate('/admin/login', { replace: true });
  };
  return (
    <header className="sticky top-0 z-40 bg-brand text-white">
      <div className="flex h-12 items-center gap-4 px-4 sm:px-6">
        <Link to="/admin" className="rounded-sm text-[15px] font-semibold tracking-[-0.005em] outline-offset-2 focus-visible:outline-2 focus-visible:outline-white">
          HRRL Activities
        </Link>
        <span className="hidden text-sm text-white sm:inline">CISO Office</span>
        <DropdownMenu>
          <DropdownMenuTrigger className="ml-auto grid size-8 place-items-center rounded-full bg-white/15 text-xs font-semibold text-white outline-offset-2 hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white" aria-label={`Account: ${me.name}`}>
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
