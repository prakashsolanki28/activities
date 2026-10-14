import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { Route } from './+types/root';
import { Toaster } from '~/components/ui/sonner';
import { TooltipProvider } from '~/components/ui/tooltip';
import { ApiError } from '~/lib/api';
import './app.css';

export const meta: Route.MetaFunction = () => [
  { title: 'HRRL Activities' },
  { name: 'description', content: 'Cybersecurity awareness activities from the HRRL CISO Office.' },
  { name: 'theme-color', content: '#ffffff' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      },
    },
  });
}

export default function App() {
  const [client] = useState(makeClient);
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delayDuration={300}>
        <Outlet />
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export function HydrateFallback() {
  return (
    <div className="grid min-h-dvh place-items-center bg-ground">
      <div className="flex items-center gap-3 text-sm text-ink-3">
        <span className="size-2 animate-pulse rounded-full bg-marker" aria-hidden />
        Loading…
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = 'Something went wrong';
  let detail = 'An unexpected error occurred. Reload the page to try again.';
  if (isRouteErrorResponse(error) && error.status === 404) {
    title = 'Page not found';
    detail = 'This address does not match any page. Check the link you were given.';
  } else if (import.meta.env.DEV && error instanceof Error) {
    detail = error.message;
  }
  return (
    <main className="grid min-h-dvh place-items-center bg-ground px-6">
      <div className="max-w-md">
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-2 text-ink-2">{detail}</p>
        <a href="/" className="mt-6 inline-block text-sm font-semibold text-slate underline">
          Go to the start
        </a>
      </div>
    </main>
  );
}
