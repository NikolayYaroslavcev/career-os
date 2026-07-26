import { createRemoteOKProvider, ConsoleLogger, InMemoryMetricsCollector, InMemoryTracer } from '@careeros/providers';

async function testRemoteOK() {
  console.log('Starting RemoteOK test...');
  const logger = new ConsoleLogger('info');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();
  
  console.log('Creating provider...');
  const provider = createRemoteOKProvider({ logger, metrics, tracer });
  
  console.log('Testing RemoteOK sync...');
  try {
    const result = await provider.sync();
    
    console.log('Sync result:', JSON.stringify(result, null, 2));
    
    if (result.ok) {
      console.log(`Imported vacancies: ${result.data.imported.length}`);
      console.log(`Metrics:`, result.data.metrics);
    } else {
      console.log('Sync failed:', result.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testRemoteOK();
