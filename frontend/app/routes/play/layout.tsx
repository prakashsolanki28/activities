import { Outlet, useParams } from 'react-router';
import type { Route } from './+types/layout';

export const meta: Route.MetaFunction = () => [{ title: 'HRRL Activities' }];

/** Employee routes share the activity slug; each page loads what it needs. */
export default function PlayLayout() {
  const { slug } = useParams();
  return <Outlet key={slug} />;
}
