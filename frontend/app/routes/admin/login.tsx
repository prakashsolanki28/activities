import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useForm } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import type { Route } from './+types/login';
import { CisoLockup, HrrlLockup } from '~/components/brand';
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
    <div className="flex min-h-dvh flex-col bg-ground px-4">
      <main className="grid flex-1 place-items-center py-10">
        <div className="w-full max-w-[440px]">
          <form
            noValidate
            className="rounded-lg bg-surface px-8 pt-8 pb-9 shadow-card sm:px-11"
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
          >
            <HrrlLockup className="h-14 sm:h-16" />
            <h1 className="mt-7 text-2xl font-semibold text-ink">Sign in</h1>
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
        </div>
      </main>
      <footer className="flex items-center justify-center gap-3 pb-8">
        <span className="text-xs text-ink-3">Powered by</span>
        <CisoLockup className="h-9" />
      </footer>
    </div>
  );
}
