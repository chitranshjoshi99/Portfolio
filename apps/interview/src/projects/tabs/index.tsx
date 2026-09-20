import { TabsWidget } from './components/tabs-widget';
import { useTabsPlayground } from './hooks/use-tabs-playground';
import type { ActivationMode } from './tabs.types';
import './tabs.css';

export default function TabsPage() {
  const p = useTabsPlayground();

  return (
    <section className="tb">
      <div className="tb__controls">
        <label className="tb__field">
          Activation
          <select value={p.activation} onChange={(event) => p.setActivation(event.target.value as ActivationMode)}>
            <option value="automatic">automatic (arrows select)</option>
            <option value="manual">manual (arrows focus, Enter selects)</option>
          </select>
        </label>
        <label className="tb__field">
          <input type="checkbox" checked={p.keepMounted} onChange={(e) => p.setKeepMounted(e.target.checked)} />
          Keep visited panels mounted
        </label>
        <label className="tb__field">
          <input type="checkbox" checked={p.syncUrl} onChange={(e) => p.setSyncUrl(e.target.checked)} />
          Sync ?tab= in the URL
        </label>
        <label className="tb__field">
          <input
            type="checkbox"
            checked={p.deferUntilVisible}
            onChange={(e) => p.setDeferUntilVisible(e.target.checked)}
          />
          Load only when on screen
        </label>
        <button type="button" className="tb__btn" onClick={p.failNext}>
          Fail next load
        </button>
        <button type="button" className="tb__btn" onClick={p.restart}>
          Reset cache
        </button>
      </div>

      <p className="tb__requests" role="status">
        requests: {p.requests.length === 0 ? 'none yet' : p.requests.join(' → ')}
      </p>

      <div className="tb__viewport">
        {p.deferUntilVisible && (
          <div className="tb__spacer">Scroll down — nothing is fetched until the tabs are on screen ↓</div>
        )}
        <TabsWidget
          key={p.generation}
          activation={p.activation}
          keepMounted={p.keepMounted}
          syncUrl={p.syncUrl}
          deferUntilVisible={p.deferUntilVisible}
        />
      </div>
    </section>
  );
}
