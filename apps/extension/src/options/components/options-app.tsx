import { useState, useEffect } from 'react';
import { BackendSettings } from './backend-settings';
import { AuthSection } from './auth-section';
import { ProviderSettings } from './provider-settings';
import { NotificationSettings } from './notification-settings';
import { PrivacySettings } from './privacy-settings';
import { defaultSettings, type ExtensionSettings } from '@careeros/extension-shared';

export function OptionsApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS', payload: {} }, (response) => {
      if (response?.ok && response.data) {
        setSettings(response.data as ExtensionSettings);
      }
      setLoading(false);
    });
  }, []);

  const handleSave = () => {
    chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: settings }, (response) => {
      if (response?.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  const updateSettings = (partial: Partial<ExtensionSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }));
  };

  if (loading) {
    return (
      <div className="options-app">
        <h1>CareerOS Settings</h1>
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="options-app">
      <h1>CareerOS Settings</h1>

      <BackendSettings
        settings={settings}
        onChange={(backend) => updateSettings({ backend })}
      />

      <AuthSection />

      <ProviderSettings
        settings={settings}
        onChange={(providers) => updateSettings({ providers })}
      />

      <NotificationSettings
        settings={settings}
        onChange={(notifications) => updateSettings({ notifications })}
      />

      <PrivacySettings
        settings={settings}
        onChange={(privacy) => updateSettings({ privacy })}
      />

      <div className="btn-group">
        <button className="btn btn-primary" onClick={handleSave}>
          Save Settings
        </button>
        {saved && <span className="status-message success">Settings saved</span>}
      </div>
    </div>
  );
}
