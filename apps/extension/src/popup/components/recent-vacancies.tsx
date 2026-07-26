import { useState, useEffect } from 'react';

interface RecentVacancySummary {
  title: string;
  company?: string;
  companyName?: string;
  location?: string;
  source?: string;
  url?: string;
  sourceUrl?: string;
}

export function RecentVacancies() {
  const [vacancies, setVacancies] = useState<RecentVacancySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.runtime.sendMessage(
      { type: 'GET_RECENT_VACANCIES', payload: { limit: 20 } },
      (response) => {
        setVacancies(response?.data ?? []);
        setLoading(false);
      }
    );
  }, []);

  if (loading) {
    return <div className="empty-state"><p>Loading...</p></div>;
  }

  if (vacancies.length === 0) {
    return (
      <div className="empty-state">
        <p>No recent vacancies</p>
        <p>Browse job sites to see vacancies here</p>
      </div>
    );
  }

  return (
    <div>
      <div className="section-title">Recent Vacancies</div>
      {vacancies.map((v, i) => (
        <div
          key={i}
          className="vacancy-card"
          onClick={() => chrome.tabs.create({ url: v.url ?? v.sourceUrl })}
        >
          <div className="title">{v.title}</div>
          <div className="company">{v.company ?? v.companyName}</div>
          <div className="meta">
            {v.location && <span>{v.location}</span>}
            {v.source && <span>{v.source}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
