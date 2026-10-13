import { Navigate } from 'react-router';

/** Sharing now opens as a side panel over the Questions tab. */
export default function PublishRedirect() {
  return <Navigate to="..?share=1" relative="path" replace />;
}
