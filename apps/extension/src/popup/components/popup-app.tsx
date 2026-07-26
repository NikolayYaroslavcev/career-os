import { useState, useEffect } from 'react';
import { LoginPage } from './login-page';
import { RecentVacancies } from './recent-vacancies';
import { StatusBar } from './status-bar';

interface AuthState {
  authenticated: boolean;
  user?: { id: string; email: string };
}

export function PopupApp() {
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [tab, setTab] = useState<'recent' | 'saved' | 'applications'>('recent');

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'CHECK_AUTH', payload: {} }, (response) => {
      setAuthState(response?.data ?? { authenticated: false });
    });
  }, []);

  const handleLogin = (user: { id: string; email: string }) => {
    setAuthState({ authenticated: true, user });
  };

  const handleLogout = () => {
    chrome.runtime.sendMessage({ type: 'LOGOUT', payload: {} }, () => {
      setAuthState({ authenticated: false });
    });
  };

  if (authState === null) {
    return (
      <div className="popup-app">
        <div className="popup-header">
          <h1>CareerOS</h1>
        </div>
        <div className="empty-state">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!authState.authenticated) {
    return (
      <div className="popup-app">
        <div className="popup-header">
          <h1>CareerOS</h1>
        </div>
        <LoginPage onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="popup-app">
      <div className="popup-header">
        <h1>CareerOS</h1>
        <StatusBar user={authState.user} onLogout={handleLogout} />
      </div>
      <div className="tab-bar">
        <button
          className={tab === 'recent' ? 'active' : ''}
          onClick={() => setTab('recent')}
        >
          Recent
        </button>
        <button
          className={tab === 'saved' ? 'active' : ''}
          onClick={() => setTab('saved')}
        >
          Saved
        </button>
        <button
          className={tab === 'applications' ? 'active' : ''}
          onClick={() => setTab('applications')}
        >
          Applications
        </button>
      </div>
      <div className="popup-content">
        {tab === 'recent' && <RecentVacancies />}
        {tab === 'saved' && <SavedToday />}
        {tab === 'applications' && <PendingApplications />}
      </div>
    </div>
  );
}

interface SavedVacancySummary {
  title: string;
  company: string;
  url: string;
}

function SavedToday() {
  const [vacancies, setVacancies] = useState<SavedVacancySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_SAVED_TODAY', payload: {} }, (response) => {
      setVacancies(response?.data ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="empty-state"><p>Loading...</p></div>;
  if (vacancies.length === 0) return <div className="empty-state"><p>No vacancies saved today</p></div>;

  return (
    <div>
      <div className="section-title">Saved Today</div>
      {vacancies.map((v, i) => (
        <div key={i} className="vacancy-card" onClick={() => chrome.tabs.create({ url: v.url })}>
          <div className="title">{v.title}</div>
          <div className="company">{v.company}</div>
        </div>
      ))}
    </div>
  );
}

interface PendingApplicationSummary {
  id: string;
  status: string;
  vacancy?: { title?: string; company?: string };
}

function PendingApplications() {
  const [applications, setApplications] = useState<PendingApplicationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_PENDING_APPLICATIONS', payload: {} }, (response) => {
      setApplications(response?.data ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="empty-state"><p>Loading...</p></div>;
  if (applications.length === 0) return <div className="empty-state"><p>No pending applications</p></div>;

  return (
    <div>
      <div className="section-title">Pending Applications</div>
      {applications.map((a, i) => (
        <div key={i} className="vacancy-card" onClick={() => chrome.tabs.create({ url: `http://localhost:3000/applications/${a.id}` })}>
          <div className="title">{a.vacancy?.title ?? 'Application'}</div>
          <div className="company">{a.vacancy?.company ?? ''}</div>
          <div className="meta">
            <span>{a.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
