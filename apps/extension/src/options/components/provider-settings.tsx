import type { ExtensionSettings } from '@careeros/extension-shared';
import { ALL_PROVIDER_IDS } from '@careeros/extension-shared';

interface ProviderSettingsProps {
  settings: ExtensionSettings;
  onChange: (providers: ExtensionSettings['providers']) => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  hh: 'HeadHunter',
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  workday: 'Workday',
  teamtailor: 'Teamtailor',
  smartrecruiters: 'SmartRecruiters',
  recruitee: 'Recruitee',
  generic: 'Generic (JSON-LD)',
};

export function ProviderSettings({ settings, onChange }: ProviderSettingsProps) {
  const toggleProvider = (providerId: string) => {
    const enabled = settings.providers.enabled.includes(providerId)
      ? settings.providers.enabled.filter(p => p !== providerId)
      : [...settings.providers.enabled, providerId];
    onChange({ enabled });
  };

  return (
    <div className="section">
      <h2>Supported Providers</h2>
      <div className="provider-grid">
        {ALL_PROVIDER_IDS.map(id => (
          <div key={id} className="provider-item">
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.providers.enabled.includes(id)}
                onChange={() => toggleProvider(id)}
              />
              <span className="slider"></span>
            </label>
            <label onClick={() => toggleProvider(id)}>
              {PROVIDER_LABELS[id] ?? id}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
