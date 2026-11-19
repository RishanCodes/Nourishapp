import { lazy, Suspense, useEffect } from 'react';
import { Layout } from './components/Layout';
import { getRecipe } from './data/recipes';
import { SLOT_LABEL, SLOT_ORDER, SLOT_TIME, toMin, weekdayOf } from './engine/planner';
import { useThemeEffect } from './lib/hooks';
import { useRoute } from './lib/router';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import { useStore } from './store/store';

const Planner = lazy(() => import('./pages/Planner'));
const Recipes = lazy(() => import('./pages/Recipes'));
const Grocery = lazy(() => import('./pages/Grocery'));
const Pantry = lazy(() => import('./pages/Pantry'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));

function useMealReminders() {
  const on = useStore((s) => s.settings.notifications);
  useEffect(() => {
    if (!on || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const sent = new Set<string>();
    const tick = () => {
      const { plan } = useStore.getState();
      if (!plan) return;
      const now = new Date();
      const d = weekdayOf(now);
      const mins = now.getHours() * 60 + now.getMinutes();
      for (const s of SLOT_ORDER) {
        const m = plan.days[d][s];
        const key = `${now.toDateString()}-${s}`;
        const diff = toMin(SLOT_TIME[s]) - mins;
        if (m && !m.prepared && diff <= 30 && diff >= 0 && !sent.has(key)) {
          sent.add(key);
          new Notification(`NOURISH · ${SLOT_LABEL[s]} at ${SLOT_TIME[s]}`, { body: getRecipe(m.recipeId)?.name ?? m.custom?.name ?? '' });
        }
      }
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [on]);
}

export default function App() {
  useThemeEffect();
  useMealReminders();
  const onboarded = useStore((s) => s.onboarded);
  const route = useRoute();
  if (!onboarded) return <Onboarding />;
  const Page = { dashboard: Dashboard, planner: Planner, recipes: Recipes, grocery: Grocery, pantry: Pantry, profile: Profile, settings: Settings }[route];
  return (
    <Layout route={route}>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-sand-200/60 dark:bg-white/5" />}>
        <Page key={route} />
      </Suspense>
    </Layout>
  );
}
