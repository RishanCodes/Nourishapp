import { CheckCircle2, HelpCircle, SendHorizontal, Wand2, X } from 'lucide-react';
import { useState } from 'react';
import { NLP_EXAMPLES } from '../engine/nlp';
import { useStore } from '../store/store';

export function CommandBar({ compact = false }: { compact?: boolean }) {
  const run = useStore((s) => s.runCommand);
  const last = useStore((s) => s.lastCommand);
  const dismiss = useStore((s) => s.dismissCommand);
  const [text, setText] = useState('');
  const [hint] = useState(() => NLP_EXAMPLES[Math.floor(Math.random() * NLP_EXAMPLES.length)]);

  const submit = (value: string) => {
    if (!value.trim()) return;
    run(value.trim());
    setText('');
  };

  return (
    <div className="no-print">
      <form onSubmit={(e) => { e.preventDefault(); submit(text); }} className="card flex items-center gap-2 p-1.5 pl-3.5">
        <Wand2 size={18} className="shrink-0 text-sage-600 dark:text-sage-400" aria-hidden />
        <label htmlFor="nl-command" className="sr-only">Adjust your plan in plain language</label>
        <input id="nl-command" value={text} onChange={(e) => setText(e.target.value)} placeholder={compact ? 'Adjust your plan…' : `Try “${hint}”`}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-ink-700/45 dark:placeholder:text-sand-200/35" />
        <button type="submit" className="btn-primary btn-sm h-9 px-3" disabled={!text.trim()} aria-label="Apply request"><SendHorizontal size={16} /></button>
      </form>
      {last && (
        <div className="animate-in mt-2 rounded-2xl border border-sand-200 bg-white p-4 text-sm shadow-soft dark:border-white/5 dark:bg-ink-900" role="status">
          <div className="flex items-start gap-2.5">
            {last.result.understood ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-sage-600" /> : <HelpCircle size={18} className="mt-0.5 shrink-0 text-clay-500" />}
            <div className="min-w-0 flex-1">
              <p className="text-xs muted">“{last.input}”</p>
              <ul className="mt-1 space-y-1">{last.result.messages.map((m) => <li key={m}>{m}</li>)}</ul>
              {!last.result.understood && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {NLP_EXAMPLES.map((ex) => <button key={ex} onClick={() => submit(ex)} className="rounded-lg border border-sand-300 px-2 py-1 text-xs hover:border-sage-500 dark:border-white/10">{ex}</button>)}
                </div>
              )}
              <p className="hint mt-2">Interpreted by NOURISH's built-in rules (no AI service). Locked meals are never changed.</p>
            </div>
            <button className="icon-btn h-7 w-7" onClick={dismiss} aria-label="Dismiss"><X size={15} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
