import type { Mapper, MappedJob } from '../../interfaces/mapper.js';
import type { RawJob } from '../../interfaces/raw-job.js';

export class AshbyMapper implements Mapper {
  readonly providerId = 'ashby';

  map(raw: RawJob): MappedJob {
    return {
      sourceId: raw.sourceId,
      title: raw.title.trim(),
      description: raw.description,
      companyName: raw.companyName.trim(),
      companySourceId: raw.companySourceId,
      location: this.splitLocation(raw.location),
      salary: raw.salary
        ? { min: raw.salary.from, max: raw.salary.to, currency: raw.salary.currency, period: raw.salary.period }
        : undefined,
      technologies: raw.technologies,
      url: raw.url,
      publishedAt: raw.publishedAt,
      fetchedAt: raw.fetchedAt,
      remote: raw.remote,
      employmentType: raw.employmentType,
      extensions: raw.extensions,
    };
  }

  private splitLocation(location: string): MappedJob['location'] {
    if (!location) {
      return { raw: 'Not specified' };
    }

    const parts = location.split(',').map((p) => p.trim()).filter(Boolean);
    const city = parts[0];
    const country = parts.length > 1 ? parts[parts.length - 1] : undefined;

    return { raw: location, city, country };
  }
}
