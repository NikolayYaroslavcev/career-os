export type TechnologyMatchLevel = 'exact' | 'alias' | 'related' | 'none';

export interface TechnologyMatchResult {
  level: TechnologyMatchLevel;
  score: number;
}

const TECH_ALIASES: Record<string, string> = {
  'reactjs': 'react',
  'react.js': 'react',
  'react ts': 'react',
  'nodejs': 'node.js',
  'node': 'node.js',
  'vuejs': 'vue',
  'vue.js': 'vue',
  'angularjs': 'angular',
  'angular.js': 'angular',
  'nextjs': 'next.js',
  'next': 'next.js',
  'nuxtjs': 'nuxt',
  'nuxt.js': 'nuxt',
  'vuejs/nuxt': 'nuxt',
  'sveltejs': 'svelte',
  'svelte.js': 'svelte',
  'expressjs': 'express',
  'express.js': 'express',
  'fastifyjs': 'fastify',
  'fastify.js': 'fastify',
  'nestjs': 'nest.js',
  'nest': 'nest.js',
  'typescript': 'typescript',
  'ts': 'typescript',
  'javascript': 'javascript',
  'js': 'javascript',
  'golang': 'golang',
  'go': 'golang',
  'csharp': 'c#',
  'c#': 'c#',
  'cplusplus': 'c++',
  'c++': 'c++',
  'dotnet': '.net',
  '.net': '.net',
  'dotnetcore': '.net core',
  '.net core': '.net core',
  'reactnative': 'react native',
  'react native': 'react native',
  'flutter': 'flutter',
  'dart': 'dart',
  'swiftui': 'swift',
  'swift': 'swift',
  'kotlin': 'kotlin',
  'postgres': 'postgresql',
  'postgresql': 'postgresql',
  'pg': 'postgresql',
  'mongo': 'mongodb',
  'mongodb': 'mongodb',
  'mssql': 'sql server',
  'sqlserver': 'sql server',
  'sql server': 'sql server',
  'gcp': 'gcp',
  'google cloud': 'gcp',
  'google cloud platform': 'gcp',
  'amazon web services': 'aws',
  'aws': 'aws',
  'microsoft azure': 'azure',
  'azure': 'azure',
  'k8s': 'kubernetes',
  'kubernetes': 'kubernetes',
  'tf': 'terraform',
  'terraform': 'terraform',
  'gh actions': 'github actions',
  'github actions': 'github actions',
  'gitlabci': 'gitlab ci',
  'gitlab-ci': 'gitlab ci',
  'gitlab ci/cd': 'gitlab ci',
  'graphql': 'graphql',
  'rest': 'rest api',
  'restful': 'rest api',
  'rest api': 'rest api',
  'grpc': 'grpc',
  'grpc/protobuf': 'grpc',
  'tailwindcss': 'tailwind',
  'tailwind css': 'tailwind',
  'tailwind': 'tailwind',
  'scss': 'scss',
  'sass': 'scss',
  'css3': 'css',
  'css': 'css',
  'html5': 'html',
  'html': 'html',
  'redux toolkit': 'redux',
  'rtk': 'redux',
  'redux': 'redux',
  'pinia': 'pinia',
  'vuex': 'vuex',
  'zustand': 'zustand',
  'mobx': 'mobx',
  'jest': 'jest',
  'cypress': 'cypress',
  'playwright': 'playwright',
  'vitest': 'vitest',
  'mocha': 'mocha',
  'chai': 'chai',
  'pytest': 'pytest',
  'unittest': 'python unittest',
  'docker': 'docker',
  'docker-compose': 'docker',
  'ansible': 'ansible',
  'helm': 'helm',
  'argocd': 'argo',
  'argo cd': 'argo',
  'consul': 'consul',
  'vault': 'vault',
  'prometheus': 'prometheus',
  'grafana': 'grafana',
  'datadog': 'datadog',
  'splunk': 'splunk',
  'elasticsearch': 'elasticsearch',
  'elastic': 'elasticsearch',
  'kibana': 'elasticsearch',
  'logstash': 'elasticsearch',
  'redis': 'redis',
  'rabbitmq': 'rabbitmq',
  'kafka': 'kafka',
  'celery': 'celery',
  'aws sqs': 'aws sqs',
  'aws sns': 'aws sns',
  'aws lambda': 'aws lambda',
  'serverless': 'serverless',
  'terraform cloud': 'terraform',
  'pulumi': 'pulumi',
  'openai api': 'openai',
  'openai': 'openai',
  'langchain': 'langchain',
  'llm': 'llm',
  'machine learning': 'machine learning',
  'ml': 'machine learning',
  'deep learning': 'deep learning',
  'dl': 'deep learning',
  'nlp': 'nlp',
  'natural language processing': 'nlp',
  'computer vision': 'computer vision',
  'pytorch': 'pytorch',
  'torch': 'pytorch',
  'tensorflow': 'tensorflow',
  'keras': 'keras',
  'scikit-learn': 'scikit-learn',
  'sklearn': 'scikit-learn',
  'pandas': 'pandas',
  'numpy': 'numpy',
  'jupyter': 'jupyter',
  'jupyter notebook': 'jupyter',
  'spark': 'spark',
  'apache spark': 'spark',
  'hadoop': 'hadoop',
  'airflow': 'airflow',
  'dbt': 'dbt',
  'snowflake': 'snowflake',
  'bigquery': 'bigquery',
  'redshift': 'redshift',
  'looker': 'looker',
  'tableau': 'tableau',
  'power bi': 'power bi',
  'powerbi': 'power bi',
  'figma': 'figma',
  'sketch': 'sketch',
  'adobe xd': 'adobe xd',
  'xd': 'adobe xd',
  'photoshop': 'photoshop',
  'illustrator': 'illustrator',
  'invision': 'invision',
  'zeplin': 'zeplin',
  'maze': 'maze',
  'principle': 'principle',
  'after effects': 'after effects',
  'framer': 'framer',
  'framer motion': 'framer motion',
  'jira': 'jira',
  'confluence': 'confluence',
  'notion': 'notion',
  'linear': 'linear',
  'productboard': 'productboard',
  'miro': 'miro',
  'amplitude': 'amplitude',
  'mixpanel': 'mixpanel',
  'google analytics': 'google analytics',
  'ga4': 'google analytics',
};

const RELATED_TECHNOLOGIES: Record<string, string[]> = {
  'react': ['react native', 'react js', 'next.js', 'remix'],
  'react native': ['react', 'expo', 'react js'],
  'vue': ['nuxt', 'vue js'],
  'angular': ['angularjs', 'ionic'],
  'node.js': ['express', 'fastify', 'nest.js', 'hapi'],
  'typescript': ['javascript'],
  'javascript': ['typescript'],
  'python': ['django', 'flask', 'fastapi', 'pyramid'],
  'java': ['spring', 'spring boot', 'kotlin'],
  'kotlin': ['java', 'android'],
  'swift': ['swiftui', 'ios'],
  'flutter': ['dart'],
  'dart': ['flutter'],
  'docker': ['kubernetes', 'docker-compose'],
  'kubernetes': ['docker', 'helm', 'argocd'],
  'aws': ['amazon web services', 'lambda', 's3', 'ec2'],
  'gcp': ['google cloud', 'bigquery', 'cloud functions'],
  'azure': ['microsoft azure'],
  'postgresql': ['postgres', 'sql'],
  'mongodb': ['mongo', 'nosql'],
  'redis': ['memcached'],
  'graphql': ['apollo', 'relay'],
  'rest api': ['rest', 'restful'],
  'machine learning': ['ml', 'deep learning', 'ai'],
  'deep learning': ['machine learning', 'ml', 'ai'],
  'pytorch': ['torch'],
  'tensorflow': ['keras'],
};

function isRelatedTech(tech1: string, tech2: string): boolean {
  const related1 = RELATED_TECHNOLOGIES[tech1];
  if (related1 && related1.includes(tech2)) return true;

  const related2 = RELATED_TECHNOLOGIES[tech2];
  if (related2 && related2.includes(tech1)) return true;

  return false;
}

export function computeTechnologyMatchLevel(userTech: string, vacancyTech: string): TechnologyMatchResult {
  const normalizedUser = normalizeTechnology(userTech);
  const normalizedVacancy = normalizeTechnology(vacancyTech);

  if (normalizedUser === normalizedVacancy) {
    if (userTech.toLowerCase().trim() === normalizedUser) {
      return { level: 'exact', score: 1.0 };
    }
    return { level: 'alias', score: 0.9 };
  }

  if (isRelatedTech(normalizedUser, normalizedVacancy)) {
    return { level: 'related', score: 0.7 };
  }

  return { level: 'none', score: 0.0 };
}

export function normalizeTechnology(name: string): string {
  const lower = name.toLowerCase().trim();
  return TECH_ALIASES[lower] ?? lower;
}

export function normalizeTechnologies(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const normalized = normalizeTechnology(name);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}
