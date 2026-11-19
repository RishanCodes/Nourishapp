import { ChevronDown, RefreshCw, Save } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { AboutSection, ActivitySection, BudgetSection, CookingSection, DietSection, GoalsSection, NumbersSection, PreferencesSection } from '../components/ProfileSections';
import { PageHeader, cx } from '../components/ui';
import { useStore } from '../store/store';
import type { Profile as P } from '../types';

export default function Profile() {
  const { profile, updateProfile, settings } = useStore();
  const [draft, setDraft] = useState<P>(profile);
  const [open, setOpen] = useState<string>('about');
  const [msg, setMsg] = useState('');
  useEffect(() => setDraft(profile), [profile]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);
  const set = (patch: Partial<P>) => setDraft((d) => ({ ...d, ...patch }));
  const save = (regen: boolean) => { updateProfile(draft, regen); setMsg(regen ? 'Saved — your plan was regenerated (locked meals kept).' : 'Profile saved.'); setTimeout(() => setMsg(''), 3000); };
  const invalid = (draft.age != null && (draft.age < 1 || draft.age > 120)) || (draft.heightCm != null && (draft.heightCm < 50 || draft.heightCm > 260)) || (draft.weightKg != null && (draft.weightKg < 10 || draft.weightKg > 350));

  const sections: [string, string, ReactNode][] = [
    ['about', 'About you', <AboutSection p={draft} set={set} units={settings.units} />],
    ['activity', 'Activity & athletic schedule', <ActivitySection p={draft} set={set} />],
    ['goals', 'Goals', <GoalsSection p={draft} set={set} />],
    ['diet', 'Diet, allergies & health', <DietSection p={draft} set={set} />],
    ['prefs', 'Food preferences', <PreferencesSection p={draft} set={set} />],
    ['cooking', 'Cooking & meals', <CookingSection p={draft} set={set} />],
    ['budget', 'Budget & shopping', <BudgetSection p={draft} set={set} />],
    ['numbers', 'Nutrition numbers', <NumbersSection p={draft} set={set} />],
  ];

  return (
    <>
      <PageHeader title="My Profile" subtitle="Changes take effect when you save. Regenerate to apply them to unlocked meals." />
      <div className="space-y-3">
        {sections.map(([key, title, body]) => (
          <section key={key} className="card overflow-hidden">
            <button className="flex w-full items-center justify-between px-5 py-4 text-left" onClick={() => setOpen(open === key ? '' : key)} aria-expanded={open === key}>
              <span className="section-title">{title}</span>
              <ChevronDown size={18} className={cx('transition', open === key && 'rotate-180')} />
            </button>
            {open === key && <div className="animate-in border-t border-sand-200 px-5 py-5 dark:border-white/5">{body}</div>}
          </section>
        ))}
      </div>
      <div className="no-print sticky bottom-20 z-20 mt-5 lg:bottom-6">
        <div className={cx('card flex flex-wrap items-center justify-between gap-3 p-3 transition', !dirty && !msg && 'opacity-80')}>
          <span className="px-2 text-sm muted" role="status">{msg || (dirty ? 'You have unsaved changes.' : 'All changes saved.')}</span>
          <div className="flex gap-2">
            <button className="btn-secondary" disabled={!dirty || invalid} onClick={() => save(false)}><Save size={15} /> Save</button>
            <button className="btn-primary" disabled={invalid} onClick={() => save(true)}><RefreshCw size={15} /> Save &amp; regenerate</button>
          </div>
        </div>
      </div>
    </>
  );
}
