import type { ExtensionSettings } from '@careeros/extension-shared';

interface PrivacySettingsProps {
  settings: ExtensionSettings;
  onChange: (privacy: ExtensionSettings['privacy']) => void;
}

export function PrivacySettings({ settings, onChange }: PrivacySettingsProps) {
  const toggle = (key: keyof ExtensionSettings['privacy']) => {
    onChange({
      ...settings.privacy,
      [key]: !settings.privacy[key],
    });
  };

  return (
    <div className="section">
      <h2>Privacy</h2>
      <div className="form-row">
        <label>Activate on all pages</label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.privacy.activateOnAllPages}
            onChange={() => toggle('activateOnAllPages')}
          />
          <span className="slider"></span>
        </label>
      </div>
      <div className="form-row">
        <label>Collect analytics</label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.privacy.collectAnalytics}
            onChange={() => toggle('collectAnalytics')}
          />
          <span className="slider"></span>
        </label>
      </div>
      <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
        CareerOS only activates on supported job websites. No browsing history is collected.
        Page content is only transmitted when you explicitly save or analyze a vacancy.
      </p>
    </div>
  );
}
