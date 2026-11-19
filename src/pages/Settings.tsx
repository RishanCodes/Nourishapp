import { Bell, Download, Moon, PlayCircle, Ruler, Sun, Trash2, Upload, Wallet } from 'lucide-react';
import { useRef, useState } from 'react';
import { CURRENCY_RATE } from '../engine/cost';
import { Dialog, Notice, PageHeader, Segmented, Toggle } from '../components/ui';
import { navigate } from '../lib/router';
import { useStore } from '../store/store';

export default function Settings() {
  const { settings, updateSettings, exportData, importData, loadDemo, resetAll, isDemo } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);
  const [confirm, setConfirm] = useState<'delete' | 'demo' | null>(null);
  const notifSupported = typeof window !== 'undefined' && 'Notification' in window;

  const doExport = () => {
    const url = URL.createObjectURL(new Blob([exportData()], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `nourish-backup-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    setMsg({ tone: 'ok', text: 'Backup downloaded. It contains your profile, including any health details — store it somewhere private.' });
  };
  const doImport = async (f: File) => {
    if (f.size > 5_000_000) return setMsg({ tone: 'warn', text: 'That file is too large to be a NOURISH backup.' });
    const r = importData(await f.text());
    setMsg(r.ok ? { tone: 'ok', text: 'Data imported successfully.' } : { tone: 'warn', text: `Import failed: ${r.error}` });
  };
  const toggleNotifications = async (on: boolean) => {
    if (!on) return updateSettings({ notifications: false });
    if (!notifSupported) return setMsg({ tone: 'warn', text: 'This browser does not support notifications.' });
    const perm = await Notification.requestPermission();
    updateSettings({ notifications: perm === 'granted' });
    if (perm !== 'granted') setMsg({ tone: 'warn', text: 'Notifications were blocked by the browser.' });
  };

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-4">
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        <section className="card divide-y divide-sand-200 dark:divide-white/5">
          <Row icon={settings.theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />} title="Appearance" hint="Follow your device or choose a theme.">
            <Segmented size="sm" options={['system', 'light', 'dark'] as const} value={settings.theme} onChange={(v) => updateSettings({ theme: v })} labels={{ system: 'System', light: 'Light', dark: 'Dark' }} />
          </Row>
          <Row icon={<Ruler size={18} />} title="Measurement units" hint="Used for grocery quantities.">
            <Segmented size="sm" options={['metric', 'imperial'] as const} value={settings.units} onChange={(v) => updateSettings({ units: v })} labels={{ metric: 'Metric', imperial: 'Imperial' }} />
          </Row>
          <Row icon={<Wallet size={18} />} title="Currency" hint="Prices are estimates converted from Canadian averages.">
            <select className="input w-28 py-2" value={settings.currency} onChange={(e) => updateSettings({ currency: e.target.value })} aria-label="Currency">{Object.keys(CURRENCY_RATE).map((c) => <option key={c}>{c}</option>)}</select>
          </Row>
          <div className="flex gap-3.5 px-5 py-4">
            <span className="mt-0.5 text-sage-600"><Bell size={18} /></span>
            <div className="flex-1">
              <Toggle checked={settings.notifications} onChange={toggleNotifications} label="Meal reminders" hint={notifSupported ? 'Shows a browser notification about 30 minutes before each planned meal while NOURISH is open. No server or push service is used.' : 'Not supported in this browser.'} />
            </div>
          </div>
        </section>

        <section className="card divide-y divide-sand-200 dark:divide-white/5">
          <Row title="Profile & dietary preferences" hint="Edit your details, diet, allergies and goals.">
            <button className="btn-secondary btn-sm" onClick={() => navigate('profile')}>Edit profile</button>
          </Row>
          <Row icon={<Download size={18} />} title="Export data" hint="Download everything as a JSON backup.">
            <button className="btn-secondary btn-sm" onClick={doExport}>Export</button>
          </Row>
          <Row icon={<Upload size={18} />} title="Import data" hint="Restore from a NOURISH backup file. Replaces current data.">
            <button className="btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>Import</button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ''; }} />
          </Row>
          <Row icon={<PlayCircle size={18} />} title={isDemo ? 'Reset demo data' : 'Load demo data'} hint="Replace your data with the sample teen basketball player profile.">
            <button className="btn-secondary btn-sm" onClick={() => setConfirm('demo')}>{isDemo ? 'Reset demo' : 'Load demo'}</button>
          </Row>
          <Row icon={<Trash2 size={18} />} title="Delete all local data" hint="Removes your profile, plans, pantry and settings from this browser.">
            <button className="btn-danger btn-sm" onClick={() => setConfirm('delete')}>Delete</button>
          </Row>
        </section>

        <section className="card space-y-2 p-5 text-sm">
          <h2 className="section-title">Privacy &amp; limitations</h2>
          <ul className="list-disc space-y-1.5 pl-5 muted">
            <li>All data is stored only in this browser's local storage. There is no account and nothing is sent to a server. Browser storage is not encrypted or medical-grade secure — anyone using this device profile could see it.</li>
            <li>Meal plans and the “adjust your plan” box use NOURISH's built-in rule-based engine, not an AI service.</li>
            <li>Grocery prices are rough estimates from average Canadian prices; nutrition values are approximate, calculated from generic reference data.</li>
            <li>NOURISH is not a medical device and does not provide medical nutrition therapy. Follow your clinician's guidance for medical conditions and severe allergies.</li>
          </ul>
        </section>
      </div>

      <Dialog open={confirm === 'delete'} onClose={() => setConfirm(null)} title="Delete all data?"
        footer={<><button className="btn-ghost" onClick={() => setConfirm(null)}>Cancel</button><button className="btn-danger" onClick={() => { resetAll(); setConfirm(null); navigate('dashboard'); }}>Delete everything</button></>}>
        <p className="text-sm">This permanently removes your profile, meal plans, saved plans, pantry and grocery progress from this browser. Consider exporting a backup first.</p>
      </Dialog>
      <Dialog open={confirm === 'demo'} onClose={() => setConfirm(null)} title="Load demo profile?"
        footer={<><button className="btn-ghost" onClick={() => setConfirm(null)}>Cancel</button><button className="btn-primary" onClick={() => { loadDemo(); setConfirm(null); navigate('dashboard'); setMsg({ tone: 'ok', text: 'Demo data loaded.' }); }}>Load demo</button></>}>
        <p className="text-sm">Your current profile, plan, pantry and grocery progress will be replaced by the demo data.</p>
      </Dialog>
    </>
  );
}

function Row({ icon, title, hint, children }: { icon?: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3.5 px-5 py-4">
      {icon && <span className="text-sage-600">{icon}</span>}
      <div className="min-w-[12rem] flex-1"><p className="text-sm font-medium">{title}</p>{hint && <p className="hint">{hint}</p>}</div>
      {children}
    </div>
  );
}
