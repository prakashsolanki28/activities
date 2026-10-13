import { useEffect } from 'react';

/**
 * Put the admin look on <html> while an admin screen is mounted, so dialogs, menus and
 * toasts (portalled to <body>) follow it too.
 */
export function useAdminTheme() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('admin-ui');
    return () => root.classList.remove('admin-ui');
  }, []);
}
