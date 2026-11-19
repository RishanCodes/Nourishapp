import { lazy, Suspense } from 'react';
import { Layout } from './components/Layout';
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

export default function App() {
  useThemeEffect();
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
