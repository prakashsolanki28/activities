import { Navigate } from 'react-router';

/** The summary now lives on the Responses tab, as in a form. */
export default function InsightsRedirect() {
  return <Navigate to="../responses" relative="path" replace />;
}
