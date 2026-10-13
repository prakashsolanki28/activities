import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useForm } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import type { Route } from './+types/login';
import { Field, fieldError } from '~/components/field';
import { ErrorNote } from '~/components/admin/ui';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { errorMessage } from '~/lib/api';
import { adminApi, adminKeys } from '~/lib/admin-api';
import { useAdminTheme } from '~/lib/admin-theme';

export const meta: Route.MetaFunction = () => [{ title: 'Sign in · HRRL Activities' }];

const schema = z.object({
  email: z.string().trim().email('Enter your work email'),
  password: z.string().min(1, 'Enter your password'),
});

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  useAdminTheme();
  const next = params.get('next')?.startsWith('/admin') ? params.get('next')! : '/admin';

  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        const { admin } = await adminApi.login(value.email.trim(), value.password);
        qc.setQueryData(adminKeys.me, admin);
        navigate(next, { replace: true });
      } catch (e) {
        setError(errorMessage(e));
      }
    },
  });

  return (
    <main className="grid min-h-dvh place-items-center bg-ground px-4 py-10">
      <div className="w-full max-w-[440px]">
        <form
          noValidate
          className="rounded-lg bg-surface px-8 pt-8 pb-9 shadow-card sm:px-11"
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <span className="grid size-6 place-items-center rounded-sm bg-brand text-[11px] font-bold text-white" aria-hidden>
              H
            </span>
            HRRL Activities
          </p>
          <h1 className="mt-6 text-2xl font-semibold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-ink-3">For the CISO Office team: build activities, share them and see the results.</p>
          <div className="mt-6 grid gap-4">
            <form.Field name="email">
              {(f) => (
                <Field label="Work email" error={fieldError(f.state.meta.errors)}>
                  {(p) => <Input {...p} type="email" autoComplete="username" className="h-9" value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} onBlur={f.handleBlur} />}
                </Field>
              )}
            </form.Field>
            <form.Field name="password">
              {(f) => (
                <Field label="Password" error={fieldError(f.state.meta.errors)}>
                  {(p) => <Input {...p} type="password" autoComplete="current-password" className="h-9" value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} onBlur={f.handleBlur} />}
                </Field>
              )}
            </form.Field>
          </div>
          {error ? <ErrorNote className="mt-4">{error}</ErrorNote> : null}
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(busy) => (
              <div className="mt-7 flex justify-end">
                <Button type="submit" className="min-w-28" disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : null}
                  Sign in
                </Button>
              </div>
            )}
          </form.Subscribe>
        </form>
        <p className="mt-4 px-1 text-[13px] text-ink-3">Forgotten your password? Ask an owner to reset it under Manage admins.</p>
      </div>
    </main>
  );
}
