#!/usr/bin/env node

const url = 'https://api.hh.ru/vacancies?text=frontend&per_page=1';

async function test() {
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CareerOS-Diagnostics/1.0 (+https://careeros.app)',
      },
    });

    const body = await response.text();
    const duration = Date.now() - startTime;

    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    console.log(JSON.stringify({
      environment: process.env.DEPLOY_ENV || 'local',
      url,
      status: response.status,
      statusText: response.statusText,
      duration,
      headers,
      bodyPreview: body.substring(0, 500),
      success: response.ok,
      timestamp: new Date().toISOString(),
    }, null, 2));

    process.exit(response.ok ? 0 : 1);
  } catch (error) {
    console.log(JSON.stringify({
      environment: process.env.DEPLOY_ENV || 'local',
      url,
      status: 0,
      error: error.message,
      duration: Date.now() - startTime,
      success: false,
      timestamp: new Date().toISOString(),
    }, null, 2));
    process.exit(1);
  }
}

test();
