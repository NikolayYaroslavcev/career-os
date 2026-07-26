export interface SpanAttributes {
  [key: string]: string | number | boolean;
}

export interface Span {
  readonly traceId: string;
  readonly spanId: string;
  readonly name: string;
  setAttribute(key: string, value: string | number | boolean): void;
  addEvent(name: string, attributes?: SpanAttributes): void;
  end(): void;
}

export interface Tracer {
  startSpan(name: string, attributes?: SpanAttributes): Span;
}

interface SpanData {
  traceId: string;
  spanId: string;
  name: string;
  attributes: SpanAttributes;
  events: Array<{ name: string; attributes?: SpanAttributes; timestamp: Date }>;
  startedAt: Date;
  endedAt?: Date;
}

export class InMemoryTracer implements Tracer {
  private spans: SpanData[] = [];

  startSpan(name: string, attributes?: SpanAttributes): Span {
    const traceId = crypto.randomUUID();
    const spanId = crypto.randomUUID();
    const spanData: SpanData = {
      traceId,
      spanId,
      name,
      attributes: attributes ?? {},
      events: [],
      startedAt: new Date(),
    };
    this.spans.push(spanData);

    return {
      traceId,
      spanId,
      name,
      setAttribute: (key: string, value: string | number | boolean): void => {
        spanData.attributes[key] = value;
      },
      addEvent: (eventName: string, eventAttributes?: SpanAttributes): void => {
        spanData.events.push({ name: eventName, attributes: eventAttributes, timestamp: new Date() });
      },
      end: (): void => {
        spanData.endedAt = new Date();
      },
    };
  }

  getSpans(): readonly SpanData[] {
    return this.spans;
  }

  getSpanByName(name: string): SpanData | undefined {
    return this.spans.find((s) => s.name === name);
  }

  reset(): void {
    this.spans = [];
  }
}

export class NoopTracer implements Tracer {
  startSpan(_name: string, _attributes?: SpanAttributes): Span {
    return {
      traceId: '',
      spanId: '',
      name: '',
      setAttribute: () => {},
      addEvent: () => {},
      end: () => {},
    };
  }
}