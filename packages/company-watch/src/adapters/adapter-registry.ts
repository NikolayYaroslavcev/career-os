import type { AtsAdapter } from './base-adapter.js';
import type { AtsType } from '../domain/value-objects/ats-type.js';
import { GreenhouseAdapter } from './greenhouse-adapter.js';
import { LeverAdapter } from './lever-adapter.js';
import { AshbyAdapter } from './ashby-adapter.js';
import { WorkdayAdapter } from './workday-adapter.js';
import { TeamtailorAdapter } from './teamtailor-adapter.js';
import { CustomHtmlAdapter } from './custom-html-adapter.js';
import { JsonLdAdapter } from './json-ld-adapter.js';

export class AtsAdapterRegistry {
  private adapters = new Map<AtsType, AtsAdapter>();

  constructor() {
    // Register Core 5 adapters
    this.adapters.set('GREENHOUSE', new GreenhouseAdapter());
    this.adapters.set('LEVER', new LeverAdapter());
    this.adapters.set('ASHBY', new AshbyAdapter());
    this.adapters.set('WORKDAY', new WorkdayAdapter());
    this.adapters.set('TEAMTAILOR', new TeamtailorAdapter());

    // Register fallback adapters
    this.adapters.set('CUSTOM_HTML', new CustomHtmlAdapter());
    this.adapters.set('JSON_LD', new JsonLdAdapter());
  }

  get(atsType: AtsType): AtsAdapter {
    const adapter = this.adapters.get(atsType);
    if (!adapter) {
      throw new Error(`No adapter registered for ATS type: ${atsType}`);
    }
    return adapter;
  }

  has(atsType: AtsType): boolean {
    return this.adapters.has(atsType);
  }

  getAll(): AtsAdapter[] {
    return Array.from(this.adapters.values());
  }

  getSupportedTypes(): AtsType[] {
    return Array.from(this.adapters.keys());
  }
}
