import { Entity } from './entity.js';

export abstract class AggregateRoot<TId> extends Entity<TId> {
  private _version = 0;

  get version(): number {
    return this._version;
  }

  protected incrementVersion(): void {
    this._version += 1;
  }
}
