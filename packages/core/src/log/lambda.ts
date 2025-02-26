export interface InvocationNext {
  id: string;
  cold: boolean;
  input?: any;
  output?: any;
  report?: {
    duration: number;
    size: number;
    memory: number;
    xray?: string;
    init?: number;
  };
  start: number;
  end?: number;
  logs: Log[];
}

export interface Log {
  id: string;
  timestamp: number;
  message: string;
}

export function LambdaGrouper() {
  const pending = new Map<string, InvocationNext>();
  const streams = new Map<
    string,
    {
      cold: boolean;
      buffer: Log[];
      current?: string;
    }
  >();

  return {
    process(input: {
      id: string;
      line: string;
      timestamp: number;
      stream: string;
    }): InvocationNext[] {
      let stream = streams.get(input.stream);
      if (!stream) {
        stream = {
          cold: false,
          buffer: [],
        };
        streams.set(input.stream, stream);
      }

      // INIT_START Runtime Version: nodejs:20.v51  Runtime Version ARN: arn:aws:lambda:us-east-1::runtime:cb6527bfb6726a080a367eca00e49765ca5abd8cd1a17783fbee683313121ece
      if (/^INIT_START/.test(input.line)) {
        stream.cold = true;
        return [];
      }

      // START RequestId: 2307132f-9014-403c-ba61-9b6c487af6f1 Version: $LATEST
      const startMatch = /^START RequestId: ([^\s]+)/.exec(input.line);
      if (startMatch) {
        const requestID = startMatch[1]!;
        const invocation: InvocationNext = {
          id: requestID,
          logs: stream.buffer,
          cold: stream.cold,
          start: input.timestamp,
        };
        pending.set(requestID, invocation);
        stream.cold = false;
        stream.buffer = [];
        stream.current = requestID;
        return [];
      }

      // END RequestId: 2307132f-9014-403c-ba61-9b6c487af6f1
      const endMatch = /^END RequestId: ([^\s]+)/.exec(input.line);
      if (endMatch) {
        const invocation = pending.get(endMatch[1]!);
        if (invocation) {
          invocation.end = input.timestamp;
          // if report line was already processed, this invocation is done
          if (invocation.report) {
            pending.delete(invocation.id);
            return [invocation];
          }
        }
        return [];
      }

      // REPORT RequestId: 2307132f-9014-403c-ba61-9b6c487af6f1	Duration: 8.83 ms	Billed Duration: 9 ms	Memory Size: 1024 MB	Max Memory Used: 65 MB	Init Duration: 138.10 ms
      const reportMatch = /^REPORT RequestId: ([^\s]+)/.exec(input.line);
      if (reportMatch) {
        const requestID = reportMatch[1]!;
        const invocation = pending.get(requestID);
        if (invocation) {
          const durationMatch = /Duration: (\d+)/.exec(input.line);
          const memoryUsedMatch = /Max Memory Used: (\d+)/.exec(input.line);
          const memorySizeMatch = /Memory Size: (\d+)/.exec(input.line);
          const initDurationMatch = /Init Duration: (\d+)/.exec(input.line);
          const xrayMatch = /XRAY TraceId: ([^\s]+)/.exec(input.line);

          invocation.report = {
            duration: parseInt(durationMatch?.[1] || "0"),
            size: parseInt(memoryUsedMatch?.[1] || "0"),
            memory: parseInt(memorySizeMatch?.[1] || "0"),
            init: initDurationMatch
              ? parseInt(initDurationMatch[1]!)
              : undefined,
            xray: xrayMatch?.[1],
          };
          // if end line was already processed, this invocation is done
          if (invocation.end) {
            pending.delete(invocation.id);
            return [invocation];
          }
        }
        return [];
      }

      // NodeJS log line: 2025-01-20T19:35:50.661Z	9da0a08b-1f13-4594-bca7-86fad8da42f0	INFO	starting 2025-01-20T19:35:50.661Z
      const logMatch = /^[\d-]+T[\d:.]+Z\t([^\s]+)/.exec(input.line);
      if (logMatch) {
        const requestID = logMatch[1]!;
        const invocation = pending.get(requestID);
        const log = {
          id: input.id,
          timestamp: input.timestamp,
          message: input.line.substring(logMatch[0].length).trim(),
        };
        if (invocation) invocation.logs.push(log);
        if (!invocation) stream.buffer.push(log);
        return [];
      }

      const log: Log = {
        id: input.id,
        timestamp: input.timestamp,
        message: input.line,
      };

      // if we're currently processing an invocation, add to its logs
      if (stream.current && pending.has(stream.current)) {
        const invocation = pending.get(stream.current)!;
        invocation.logs.push(log);
        return [];
      }

      // hang onto this log line for when we see an invocation start
      stream.buffer.push(log);

      return [];
    },
  };
}
