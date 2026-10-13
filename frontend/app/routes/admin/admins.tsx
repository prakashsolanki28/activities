import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import { KeyRound, Loader2, MoreHorizontal, Trash2, UserPlus } from 'lucide-react';
import type { AdminUser } from '@hrrl/shared';
import type { Route } from './+types/admins';
import { Field, fieldError } from '~/components/field';
import { ErrorNote, PageHeader } from '~/components/admin/ui';
import { td, th } from '~/components/admin/data-table';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';
import { errorMessage } from '~/lib/api';
import { adminApi, adminKeys, useMe } from '~/lib/admin-api';
import { formatDate } from '~/lib/format';
import { cn } from '~/lib/utils';

export const meta: Route.MetaFunction = () => [{ title: 'Admins · HRRL Activities' }];

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, AdminUser>();
const columns = helper.columns([helper.accessor('name', { header: 'Name' }), helper.accessor('email', { header: 'Email' }), helper.accessor('role', { header: 'Role' })]);
const none: AdminUser[] = [];

export default function Admins() {
  const me = useMe();
  const qc = useQueryClient();
  const users = useQuery({ queryKey: adminKeys.users, queryFn: adminApi.users });
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const isOwner = me.data?.role === 'owner';
  const table = useTable({ features, columns, data: users.data ?? none });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof adminApi.updateUser>[1] }) => adminApi.updateUser(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.users });
      toast.success('Saved');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.removeUser(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.users });
      toast.success('Admin removed');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const roleControl = (u: AdminUser, self: boolean) =>
    isOwner && !self ? (
      <Select value={u.role} onValueChange={(role) => update.mutate({ id: u._id, body: { role: role as AdminUser['role'] } })}>
        <SelectTrigger size="sm" className="w-32" aria-label={`Role for ${u.name}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="owner">Owner</SelectItem>
          <SelectItem value="editor">Editor</SelectItem>
        </SelectContent>
      </Select>
    ) : (
      <span className="text-ink-2">{u.role === 'owner' ? 'Owner' : 'Editor'}</span>
    );
  const actions = (u: AdminUser, self: boolean) =>
    isOwner ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setResetting(u)}>
            <KeyRound /> Set new password
          </DropdownMenuItem>
          {!self ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => remove.mutate(u._id)}>
                <Trash2 /> Remove access
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  return (
    <main className="mx-auto max-w-[1120px] px-4 py-8 sm:px-8">
      <PageHeader
        title="Manage admins"
        description="People who can sign in here. Owners can also add and remove admins; editors build activities and read results."
        actions={
          isOwner ? (
            <Button onClick={() => setAdding(true)}>
              <UserPlus /> Add admin
            </Button>
          ) : null
        }
      />
      {users.error ? <ErrorNote className="mt-6">{errorMessage(users.error)}</ErrorNote> : null}
      <div className="mt-6 overflow-hidden rounded-lg bg-surface shadow-card">
        {/* Phones get stacked rows; the table starts at the sm breakpoint. */}
        <ul className="divide-y divide-line sm:hidden">
          {(users.data ?? none).map((u) => {
            const self = u._id === me.data?._id;
            return (
              <li key={u._id} className="flex items-start gap-2 py-3 pr-2 pl-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {u.name}
                    {self ? <span className="ml-2 text-xs font-normal text-ink-3">you</span> : null}
                  </p>
                  <p className="truncate text-[13px] text-ink-2">{u.email}</p>
                  <div className="mt-2 flex items-center gap-3 text-[13px]">
                    {roleControl(u, self)}
                    <span className="text-ink-3">Added {formatDate(u.createdAt)}</span>
                  </div>
                </div>
                {actions(u, self)}
              </li>
            );
          })}
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line">
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Email</th>
                <th className={cn(th, 'w-40')}>Role</th>
                <th className={cn(th, 'w-32')}>Added</th>
                <th className={cn(th, 'w-12')}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {table.getRowModel().rows.map((row) => {
                const u = row.original;
                const self = u._id === me.data?._id;
                return (
                  <tr key={u._id}>
                    <td className={cn(td, 'font-semibold text-ink')}>
                      {u.name}
                      {self ? <span className="ml-2 text-xs font-normal text-ink-3">you</span> : null}
                    </td>
                    <td className={cn(td, 'text-ink-2')}>{u.email}</td>
                    <td className={td}>
                      {roleControl(u, self)}
                    </td>
                    <td className={cn(td, 'whitespace-nowrap text-ink-3')}>{formatDate(u.createdAt)}</td>
                    <td className={td}>
                      {actions(u, self)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <AddAdminDialog open={adding} onOpenChange={setAdding} />
      <PasswordDialog user={resetting} onClose={() => setResetting(null)} onSave={(password) => update.mutate({ id: resetting!._id, body: { password } }, { onSuccess: () => setResetting(null) })} />
    </main>
  );
}

const addSchema = z.object({
  name: z.string().trim().min(2, 'Enter their name'),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(10, 'Use at least 10 characters'),
  role: z.enum(['owner', 'editor']),
});

function AddAdminDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { name: '', email: '', password: '', role: 'editor' as 'owner' | 'editor' },
    validators: { onSubmit: addSchema },
    onSubmit: async ({ value, formApi }) => {
      setError(null);
      try {
        await adminApi.createUser(value);
        void qc.invalidateQueries({ queryKey: adminKeys.users });
        toast.success(`${value.name} can now sign in`);
        formApi.reset();
        onOpenChange(false);
      } catch (e) {
        setError(errorMessage(e));
      }
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Add admin</DialogTitle>
            <DialogDescription>Share the password with them directly. They can sign in straight away.</DialogDescription>
          </DialogHeader>
          <div className="mt-5 grid gap-4">
            <form.Field name="name">
              {(f) => <Field label="Name" error={fieldError(f.state.meta.errors)}>{(p) => <Input {...p} value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} />}</Field>}
            </form.Field>
            <form.Field name="email">
              {(f) => <Field label="Email" error={fieldError(f.state.meta.errors)}>{(p) => <Input {...p} type="email" value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} />}</Field>}
            </form.Field>
            <form.Field name="password">
              {(f) => (
                <Field label="Temporary password" hint="At least 10 characters." error={fieldError(f.state.meta.errors)}>
                  {(p) => <Input {...p} type="text" autoComplete="new-password" className="font-mono" value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} />}
                </Field>
              )}
            </form.Field>
            <form.Field name="role">
              {(f) => (
                <Field label="Role">
                  {(p) => (
                    <Select value={f.state.value} onValueChange={(v) => f.handleChange(v as 'owner' | 'editor')}>
                      <SelectTrigger {...p} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="editor">Editor: builds activities, reads results</SelectItem>
                        <SelectItem value="owner">Owner: also manages admins</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              )}
            </form.Field>
          </div>
          {error ? <ErrorNote className="mt-4">{error}</ErrorNote> : null}
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(busy) => (
                <Button type="submit" disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : null} Add admin
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({ user, onClose, onSave }: { user: AdminUser | null; onClose: () => void; onSave: (password: string) => void }) {
  const [password, setPassword] = useState('');
  return (
    <Dialog
      open={!!user}
      onOpenChange={(o) => {
        if (!o) {
          setPassword('');
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (password.length >= 10) onSave(password);
          }}
        >
          <DialogHeader>
            <DialogTitle>New password for {user?.name}</DialogTitle>
            <DialogDescription>They will use it next time they sign in.</DialogDescription>
          </DialogHeader>
          <Field label="Password" hint="At least 10 characters." className="mt-5">
            {(p) => <Input {...p} autoFocus type="text" autoComplete="new-password" className="font-mono" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={password.length < 10}>
              Set password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
