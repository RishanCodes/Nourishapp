import { beforeAll, describe, expect, it, vi } from 'vitest';

// In-memory localStorage so the persisted store can run under Node.
const mem = new Map<string, string>();
beforeAll(() => {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  });
});

describe('persistence & data management', () => {
  it('persists onboarding, plan edits and grocery checks, and restores them in a fresh store', async () => {
    const { useStore, STORAGE_KEY } = await import('./store');
    const s = useStore.getState();
    s.completeOnboarding({ ...s.profile, name: 'Sam', age: 34, allergies: ['peanut'], diet: ['vegetarian'] });
    const st = useStore.getState();
    expect(st.onboarded).toBe(true);
    expect(st.profile.allergies).toEqual(['peanut']);
    expect(st.plan?.days).toHaveLength(7);
    st.toggleLock(0, 'dinner');
    st.setChecked('basmati_rice|mass', 100);
    const raw = JSON.parse(mem.get(STORAGE_KEY)!);
    expect(raw.state.profile.name).toBe('Sam');
    expect(raw.state.plan.days[0].dinner.locked).toBe(true);

    // simulate a page reload: new module instance rehydrates from storage
    vi.resetModules();
    const fresh = await import('./store');
    await fresh.useStore.persist.rehydrate();
    const r = fresh.useStore.getState();
    expect(r.profile.name).toBe('Sam');
    expect(r.plan?.days[0].dinner?.locked).toBe(true);
    expect(r.grocery.checked['basmati_rice|mass']).toBe(100);
  });

  it('servings changes are clamped and stored', async () => {
    const { useStore } = await import('./store');
    const st = useStore.getState();
    st.loadDemo();
    useStore.getState().setServings(0, 'dinner', 3.3);
    expect(useStore.getState().plan!.days[0].dinner!.servings).toBe(3.5);
    useStore.getState().setServings(0, 'dinner', -4);
    expect(useStore.getState().plan!.days[0].dinner!.servings).toBe(0.5);
  });

  it('demo profile never enables numeric targets', async () => {
    const { useStore } = await import('./store');
    useStore.getState().loadDemo();
    useStore.getState().updateProfile({ showNumbers: true });
    expect(useStore.getState().profile.showNumbers).toBe(false);
  });

  it('exports and re-imports data; rejects invalid files', async () => {
    const { useStore } = await import('./store');
    useStore.getState().loadDemo();
    const json = useStore.getState().exportData();
    useStore.getState().resetAll();
    expect(useStore.getState().onboarded).toBe(false);
    expect(useStore.getState().importData(json).ok).toBe(true);
    expect(useStore.getState().profile.primarySport).toBe('Basketball');
    expect(useStore.getState().importData('not json').ok).toBe(false);
    expect(useStore.getState().importData('{"foo":1}').error).toMatch(/profile/);
  });

  it('sanitises invalid profile input', async () => {
    const { sanitizeProfile } = await import('./store');
    const p = sanitizeProfile({ age: -3 as unknown as number, heightCm: 9999, householdSize: 0, eatersPerMeal: 50, diet: [] });
    expect(p.age).toBeNull();
    expect(p.heightCm).toBeNull();
    expect(p.householdSize).toBe(1);
    expect(p.eatersPerMeal).toBe(1);
    expect(p.diet).toEqual(['omnivore']);
  });
});
