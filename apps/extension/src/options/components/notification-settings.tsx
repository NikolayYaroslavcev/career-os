import type { ExtensionSettings } from '@careeros/extension-shared';

interface NotificationSettingsProps {
  settings: ExtensionSettings;
  onChange: (notifications: ExtensionSettings['notifications']) => void;
}

export function NotificationSettings({ settings, onChange }: NotificationSettingsProps) {
  const toggle = (key: keyof ExtensionSettings['notifications']) => {
    onChange({
      ...settings.notifications,
      [key]: !settings.notifications[key],
    });
  };

  return (
    <div className="section">
      <h2>Notifications</h2>
      <div className="form-row">
        <label>Enable notifications</label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.notifications.enabled}
            onChange={() => toggle('enabled')}
          />
          <span className="slider"></span>
        </label>
      </div>
      {settings.notifications.enabled && (
        <>
          <div className="form-row">
            <label>Watched company vacancies</label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.notifications.watchedCompanies}
                onChange={() => toggle('watchedCompanies')}
              />
              <span className="slider"></span>
            </label>
          </div>
          <div className="form-row">
            <label>AI task completed</label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.notifications.aiCompleted}
                onChange={() => toggle('aiCompleted')}
              />
              <span className="slider"></span>
            </label>
          </div>
          <div className="form-row">
            <label>Interview reminders</label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.notifications.interviewReminders}
                onChange={() => toggle('interviewReminders')}
              />
              <span className="slider"></span>
            </label>
          </div>
          <div className="form-row">
            <label>Application follow-ups</label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.notifications.followUps}
                onChange={() => toggle('followUps')}
              />
              <span className="slider"></span>
            </label>
          </div>
        </>
      )}
    </div>
  );
}
