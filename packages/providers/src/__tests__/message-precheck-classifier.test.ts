import { describe, it, expect } from 'vitest';
import { isLikelyJobPost, classifyDeterministicRejection, runTelegramPrecheck } from '../shared/message-precheck-classifier.js';

describe('isLikelyJobPost', () => {
  it('rejects service messages regardless of content', () => {
    expect(isLikelyJobPost('We are hiring a Senior Developer!', { isServiceMessage: true })).toBe(false);
  });

  it('rejects short text with no real content', () => {
    expect(isLikelyJobPost('hi')).toBe(false);
  });

  it('rejects a non-IT vacancy that only has generic hiring-intent words', () => {
    expect(isLikelyJobPost('Вакансия: ищем менеджера по продажам в нашу команду')).toBe(false);
  });

  it('accepts an IT vacancy phrased with only generic hiring words plus an IT role', () => {
    expect(isLikelyJobPost('Ищем Frontend разработчика в команду, удалёнка, з/п от 200к')).toBe(true);
  });

  it('accepts text containing a tech keyword', () => {
    expect(isLikelyJobPost('Looking for someone comfortable with typescript and react daily')).toBe(true);
  });

  it('accepts a tech-adjacent role (product/analyst/UX) with no explicit tech stack', () => {
    expect(isLikelyJobPost('Ищем Product Manager в наш стартап, полная занятость, удалённо')).toBe(true);
  });

  it('rejects plain chatter with neither signal', () => {
    expect(isLikelyJobPost('Happy Friday to everyone in the chat, enjoy your weekend plans!')).toBe(false);
  });
});

describe('classifyDeterministicRejection', () => {
  it('rejects a candidate looking for work', () => {
    const result = classifyDeterministicRejection('Ищу работу Frontend разработчиком, опыт с React 3 года');
    expect(result?.category).toBe('resume_candidate_seeking');
  });

  it('rejects an English "open to work" post', () => {
    const result = classifyDeterministicRejection('Open to work as a backend engineer, experience with Python and Django');
    expect(result?.category).toBe('resume_candidate_seeking');
  });

  it('does NOT reject a real vacancy asking candidates to send a resume', () => {
    expect(classifyDeterministicRejection('Ищем Frontend разработчика. Пришлите резюме на hr@company.com')).toBeNull();
  });

  it('rejects a recruiter self-promotion pitch', () => {
    const result = classifyDeterministicRejection('Помогу с трудоустройством в IT, пишите в личку, разберём ваше резюме');
    expect(result?.category).toBe('recruiter_self_promotion');
  });

  it('does NOT reject a recruiter posting one concrete role', () => {
    const result = classifyDeterministicRejection('Кадровое агентство ищет Senior Java разработчика для клиента, з/п от 300к, требования: Spring, Kafka');
    expect(result).toBeNull();
  });

  it('rejects an agency self-promotion post', () => {
    const result = classifyDeterministicRejection('Наше кадровое агентство приглашает к сотрудничеству IT-специалистов');
    expect(result?.category).toBe('agency_promotion');
  });

  it('rejects a course/bootcamp ad even when it mentions a tech stack', () => {
    const result = classifyDeterministicRejection('Онлайн-курс по React и TypeScript, старт потока уже в понедельник, запись на курс открыта');
    expect(result?.category).toBe('course_bootcamp');
  });

  it('rejects a webinar/event announcement', () => {
    const result = classifyDeterministicRejection('Приглашаем на вебинар про карьеру в DevOps, регистрируйтесь');
    expect(result?.category).toBe('webinar_event');
  });

  it('rejects a giveaway post', () => {
    const result = classifyDeterministicRejection('Розыгрыш фирменного мерча компании, участвуй и выиграй приз');
    expect(result?.category).toBe('giveaway');
  });

  it('rejects a crypto post even if it mentions tech keywords', () => {
    const result = classifyDeterministicRejection('Ищем разработчика в криптовалютный проект, знание blockchain, оплата в bitcoin');
    expect(result?.category).toBe('crypto');
  });

  it('rejects an affiliate/sponsorship post', () => {
    const result = classifyDeterministicRejection('На правах рекламы: используйте промокод DEV10 для скидки на курс');
    expect(result?.category).toBe('affiliate_sponsorship');
  });

  it('rejects a newsletter/news digest post', () => {
    const result = classifyDeterministicRejection('Дайджест недели: главные новости IT-индустрии, подписывайтесь на канал');
    expect(result?.category).toBe('newsletter_news');
  });

  it('does not reject a plain real vacancy', () => {
    expect(classifyDeterministicRejection('Ищем Backend разработчика (Node.js, PostgreSQL), удалённо, з/п от 250к')).toBeNull();
  });
});

describe('runTelegramPrecheck', () => {
  it('rejects service messages with category service_message', () => {
    const result = runTelegramPrecheck('We are hiring a Senior Developer!', { isServiceMessage: true });
    expect(result).toEqual({ accepted: false, category: 'service_message', ruleId: 'service_message', matchedText: '' });
  });

  it('rejects short text with category too_short', () => {
    const result = runTelegramPrecheck('hi');
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.category).toBe('too_short');
  });

  it('rejects a course ad before the tech-keyword gate ever runs', () => {
    const result = runTelegramPrecheck('Онлайн-курс по React и TypeScript, старт потока уже в понедельник, запись на курс открыта');
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.category).toBe('course_bootcamp');
  });

  it('rejects IT-irrelevant chatter with category not_it_relevant', () => {
    const result = runTelegramPrecheck('Happy Friday to everyone in the chat, enjoy your weekend plans and have a great time!');
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.category).toBe('not_it_relevant');
  });

  it('accepts a real IT vacancy', () => {
    const result = runTelegramPrecheck('Ищем Backend разработчика (Node.js, PostgreSQL), удалённо, з/п от 250к');
    expect(result).toEqual({ accepted: true });
  });

  it('accepts a real vacancy that asks candidates to send a resume', () => {
    const result = runTelegramPrecheck('Ищем Frontend разработчика, React/TypeScript. Пришлите резюме на hr@company.com');
    expect(result).toEqual({ accepted: true });
  });
});
