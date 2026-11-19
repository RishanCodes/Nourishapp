import { useEffect, useMemo } from 'react';
import { buildGroceryList, summarize } from '../engine/grocery';
import { money } from '../engine/cost';
import { useStore } from '../store/store';

export function useGrocery() {
  const plan = useStore((s) => s.plan);
  const profile = useStore((s) => s.profile);
  const pantry = useStore((s) => s.pantry);
  const grocery = useStore((s) => s.grocery);
  return useMemo(() => {
    const items = buildGroceryList(plan, profile, pantry, grocery);
    return { items, summary: summarize(items, grocery.custom) };
  }, [plan, profile, pantry, grocery]);
}

export function useMoney() {
  const currency = useStore((s) => s.settings.currency);
  return (cad: number) => money(cad, currency);
}

export function useThemeEffect() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#101210' : '#f4f2ec');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}
