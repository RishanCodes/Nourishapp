import { useEffect, useState } from 'react';

export type Route = 'dashboard' | 'planner' | 'recipes' | 'grocery' | 'pantry' | 'profile' | 'settings';
export const ROUTES: Route[] = ['dashboard', 'planner', 'recipes', 'grocery', 'pantry', 'profile', 'settings'];

// Plain `#name` hashes so links also work where only simple fragments are allowed (e.g. hosted artifacts).
// "settings" is reserved by some hosts, so that page uses #app-settings.
const HASH: Record<Route, string> = {
  dashboard: 'dashboard', planner: 'planner', recipes: 'recipes', grocery: 'grocery',
  pantry: 'pantry', profile: 'profile', settings: 'app-settings',
};

export const hrefFor = (r: Route) => `#${HASH[r]}`;

function read(): Route {
  const h = window.location.hash.replace(/^#\/?/, '').split(/[?/]/)[0];
  const hit = ROUTES.find((r) => HASH[r] === h || r === h);
  return hit ?? 'dashboard';
}

export function navigate(r: Route) {
  if (read() !== r || !window.location.hash) window.location.hash = HASH[r];
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
