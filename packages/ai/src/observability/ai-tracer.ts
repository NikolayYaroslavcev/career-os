export interface AISpanAttributes {
  readonly [key: string]: string | number | boolean;
}

export interface AISpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly name: string;
  setAttribute(key: string, value: string | number | boolean): void;
  addEvent(name: string, attributes?: AISpanAttributes): void;
  end(): void;
}

export interface AITracer {
  startSpan(name: string, attributes?: AISpanAttributes): AISpan;
}

interface SpanData {
  traceId: string;
  spanId: string;
  name: string;
  attributes: Record<string, string | number | boolean>;
  events: Array<{ name: string; attributes?: AISpanAttributes; timestamp: Date }>;
  startedAt: Date;
  endedAt?: Date;
}

export class InMemoryAITracer implements AITracer {
  private spans: SpanData[] = [];

  startSpan(name: string, attributes?: AISpanAttributes): AISpan {
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
      addEvent: (eventName: string, eventAttributes?: AISpanAttributes): void => {
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

export class NoopAITracer implements AITracer {
  startSpan(_name: string, _attributes?: AISpanAttributes): AISpan {
    return {
      traceId: '',
      spanId: '',
      name: '',
      setAttribute: (_key: string, _value: string | number | boolean): void => {},
      addEvent: (_name: string, _attributes?: AISpanAttributes): void => {},
      end: (): void => {},
    };
  }
}
