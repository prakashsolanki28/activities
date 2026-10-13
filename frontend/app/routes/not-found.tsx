import { Link } from 'react-router';
import type { Route } from './+types/not-found';
import { PublicMessage } from '~/components/play/public-shell';
import { Button } from '~/components/ui/button';

export const meta: Route.MetaFunction = () => [{ title: 'Page not found · HRRL Activities' }];

export default function NotFound() {
  return (
    <PublicMessage
      title="Page not found"
      action={
        <Button asChild variant="outline">
          <Link to="/">Go to the start</Link>
        </Button>
      }
    >
      This address does not match any page. Check the link you were given.
    </PublicMessage>
  );
}
