/**
 * HeadHunter API Diagnostics Script
 * 
 * Tests various request configurations to determine why the HH API
 * returns 403 Forbidden with DDoS-Guard.
 * 
 * Run: npx tsx scripts/hh-diagnostics.ts
 */

interface TestResult {
  name: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  requestId?: string;
  success: boolean;
}

const BASE_URL = 'https://api.hh.ru';
const ACCESS_TOKEN = process.env.HH_ACCESS_TOKEN;

async function testEndpoint(
  name: string,
  path: string,
  headers: Record<string, string> = {},
): Promise<TestResult> {
  const url = `${BASE_URL}${path}`;
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...headers,
      },
    });

    const body = await response.text();
    const duration = Date.now() - startTime;

    let requestId: string | undefined;
    try {
      const json = JSON.parse(body);
      requestId = json.request_id;
    } catch {
      // Not JSON
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST: ${name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`URL: ${url}`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Request ID: ${requestId || 'N/A'}`);
    console.log(`Response Headers:`);
    Object.entries(responseHeaders).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    console.log(`Body (first 500 chars):`);
    console.log(body.substring(0, 500));

    return {
      name,
      status: response.status,
      headers: responseHeaders,
      body,
      requestId,
      success: response.ok,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST: ${name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`URL: ${url}`);
    console.log(`ERROR: ${message}`);
    console.log(`Duration: ${duration}ms`);

    return {
      name,
      status: 0,
      headers: {},
      body: message,
      success: false,
    };
  }
}

async function runDiagnostics() {
  console.log('HeadHunter API Diagnostics');
  console.log('========================');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Access Token: ${ACCESS_TOKEN ? 'configured' : 'not configured'}`);
  console.log('');

  const results: TestResult[] = [];

  // A) Plain request (no special headers)
  results.push(await testEndpoint(
    'A) Plain request',
    '/vacancies?per_page=1',
    {},
  ));

  // B) User-Agent only
  results.push(await testEndpoint(
    'B) User-Agent only',
    '/vacancies?per_page=1',
    {
      'User-Agent': 'CareerOS-JobSearchAgent/1.0 (+https://careeros.app)',
    },
  ));

  // C) HH-User-Agent only
  results.push(await testEndpoint(
    'C) HH-User-Agent only',
    '/vacancies?per_page=1',
    {
      'HH-User-Agent': 'CareerOS/1.0',
    },
  ));

  // D) Both User-Agent + HH-User-Agent
  results.push(await testEndpoint(
    'D) Both User-Agent + HH-User-Agent',
    '/vacancies?per_page=1',
    {
      'User-Agent': 'CareerOS-JobSearchAgent/1.0 (+https://careeros.app)',
      'HH-User-Agent': 'CareerOS/1.0',
    },
  ));

  // E) Authorization header (if configured)
  if (ACCESS_TOKEN) {
    results.push(await testEndpoint(
      'E) Authorization header',
      '/vacancies?per_page=1',
      {
        'User-Agent': 'CareerOS-JobSearchAgent/1.0 (+https://careeros.app)',
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
      },
    ));
  } else {
    console.log('\nSkipping E) Authorization header - HH_ACCESS_TOKEN not set');
  }

  // F) Different Accept headers
  results.push(await testEndpoint(
    'F) Accept: application/json',
    '/vacancies?per_page=1',
    {
      'User-Agent': 'CareerOS-JobSearchAgent/1.0 (+https://careeros.app)',
      'Accept': 'application/json',
    },
  ));

  results.push(await testEndpoint(
    'F2) Accept: */*',
    '/vacancies?per_page=1',
    {
      'User-Agent': 'CareerOS-JobSearchAgent/1.0 (+https://careeros.app)',
      'Accept': '*/*',
    },
  ));

  // G) Different Accept-Language headers
  results.push(await testEndpoint(
    'G) Accept-Language: ru-RU,ru;q=0.9',
    '/vacancies?per_page=1',
    {
      'User-Agent': 'CareerOS-JobSearchAgent/1.0 (+https://careeros.app)',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  ));

  results.push(await testEndpoint(
    'G2) Accept-Language: en-US',
    '/vacancies?per_page=1',
    {
      'User-Agent': 'CareerOS-JobSearchAgent/1.0 (+https://careeros.app)',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  ));

  // H) Different query parameters
  results.push(await testEndpoint(
    'H) Minimal query (per_page=1)',
    '/vacancies?per_page=1',
    {
      'User-Agent': 'CareerOS-JobSearchAgent/1.0 (+https://careeros.app)',
    },
  ));

  results.push(await testEndpoint(
    'H2) With area parameter',
    '/vacancies?per_page=1&area=113',
    {
      'User-Agent': 'CareerOS-JobSearchAgent/1.0 (+https://careeros.app)',
    },
  ));

  results.push(await testEndpoint(
    'H3) With text parameter',
    '/vacancies?per_page=1&text=javascript',
    {
      'User-Agent': 'CareerOS-JobSearchAgent/1.0 (+https://careeros.app)',
    },
  ));

  // I) Test endpoints that should work
  results.push(await testEndpoint(
    'I) /areas (should work)',
    '/areas',
    {
      'User-Agent': 'CareerOS-JobSearchAgent/1.0 (+https://careeros.app)',
    },
  ));

  results.push(await testEndpoint(
    'I2) /dictionaries (should work)',
    '/dictionaries',
    {
      'User-Agent': 'CareerOS-JobSearchAgent/1.0 (+https://careeros.app)',
    },
  ));

  // J) Test single vacancy endpoint
  results.push(await testEndpoint(
    'J) Single vacancy /vacancies/{id}',
    '/vacancies/97930983',
    {
      'User-Agent': 'CareerOS-JobSearchAgent/1.0 (+https://careeros.app)',
    },
  ));

  // Summary
  console.log('\n\n');
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);
  
  console.log(`\nSuccessful: ${successes.length}/${results.length}`);
  successes.forEach(r => console.log(`  ✓ ${r.name} (${r.status})`));
  
  console.log(`\nFailed: ${failures.length}/${results.length}`);
  failures.forEach(r => console.log(`  ✗ ${r.name} (${r.status})`));

  console.log('\n\n');
  console.log('='.repeat(60));
  console.log('ANALYSIS');
  console.log('='.repeat(60));
  
  const allForbidden = failures.every(r => r.status === 403);
  const areasWorks = successes.some(r => r.name.includes('/areas'));
  const dictionariesWorks = successes.some(r => r.name.includes('/dictionaries'));
  const vacanciesBlocked = failures.some(r => r.name.includes('/vacancies'));
  
  console.log(`\n1. DDoS-Guard blocking vacancies endpoint: ${vacanciesBlocked ? 'YES' : 'NO'}`);
  console.log(`2. Other endpoints accessible: ${areasWorks && dictionariesWorks ? 'YES' : 'NO'}`);
  console.log(`3. All vacancy tests fail with 403: ${allForbidden ? 'YES' : 'NO'}`);
  
  if (allForbidden && vacanciesBlocked) {
    console.log('\n⚠️  CONCLUSION: The 403 is an IP-level block by DDoS-Guard.');
    console.log('   This is NOT an API error from HeadHunter.');
    console.log('   The block cannot be bypassed by changing headers.');
    console.log('   The issue is at the CDN/WAF layer, not the application layer.');
  }
}

runDiagnostics().catch(console.error);
