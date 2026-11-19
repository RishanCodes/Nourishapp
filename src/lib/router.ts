import { useEffect, useState } from 'react';

export type Route = 'dashboard' | 'planner' | 'recipes' | 'grocery' | 'pantry' | 'profile' | 'settings';
export const ROUTES: Route[] = ['dashboard', 'planner', 'recipes', 'grocery', 'pantry', 'profile', 'settings'];

function read(): Route {
  const h = window.location.hash.replace(/^#\/?/, '').split('?')[0] as Route;
  return ROUTES.includes(h) ? h : 'dashboard';
}

export function navigate(r: Route) {
  if (read() !== r) window.location.hash = `/${r}`;
  window.scrollTo({ top: 0 });
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
