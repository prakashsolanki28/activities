import { Navigate } from 'react-router';

/** The activity list lives on the admin home page now. */
export default function ActivitiesRedirect() {
  return <Navigate to="/admin" replace />;
}
