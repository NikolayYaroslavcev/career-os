import type { ExtensionSettings } from '@careeros/extension-shared';

interface BackendSettingsProps {
  settings: ExtensionSettings;
  onChange: (backend: ExtensionSettings['backend']) => void;
}

export function BackendSettings({ settings, onChange }: BackendSettingsProps) {
  return (
    <div className="section">
      <h2>Backend Connection</h2>
      <div className="form-row">
        <label htmlFor="backend-url">Backend URL</label>
        <input
          id="backend-url"
          type="url"
          value={settings.backend.url}
          onChange={(e) => onChange({ ...settings.backend, url: e.target.value })}
          placeholder="http://localhost:3000"
        />
      </div>
      <div className="form-row">
        <label htmlFor="dashboard-url">Dashboard URL</label>
        <input
          id="dashboard-url"
          type="url"
          value={settings.backend.dashboardUrl}
          onChange={(e) => onChange({ ...settings.backend, dashboardUrl: e.target.value })}
          placeholder="http://localhost:3001"
        />
      </div>
    </div>
  );
}
