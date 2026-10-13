import { Link } from 'react-router';
import type { Route } from './+types/home';
import { PublicShell } from '~/components/play/public-shell';
import { Button } from '~/components/ui/button';

export const meta: Route.MetaFunction = () => [{ title: 'HRRL Activities' }];

export default function Home() {
  return (
    <PublicShell
      right={
        <Button asChild variant="shell" size="sm">
          <Link to="/admin">CISO Office sign in</Link>
        </Button>
      }
    >
      <div className="max-w-xl">
        <h1 className="text-3xl leading-tight font-extrabold tracking-[-0.02em] text-ink">Cybersecurity awareness activities</h1>
        <p className="mt-4 text-[17px] leading-7 text-ink-2">
          Activities open from the link or QR code the CISO Office shares with you. If you were sent a link, open it to take part.
        </p>
      </div>
    </PublicShell>
  );
}
