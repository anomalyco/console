import { format } from "util";

export function patchLogger() {
  const log = (level: any, message: any, ...params: any[]) => {
    let time = new Date().toISOString();
    let requestId = "00000000-0000-0000-0000-000000000000";
    let line = `${time}\t${requestId}\t${level.name}\t${format(
      message,
      ...params,
    )}`;
    line = line.replace(/\n/g, "\r");
    process.stdout.write(line + "\n");
  };
  const NopLog = (_message: any, ..._params: any[]) => {};
  const levels = Object.freeze({
    TRACE: { name: "TRACE", priority: 1, tlvMask: 0b00100 },
    DEBUG: { name: "DEBUG", priority: 2, tlvMask: 0b01000 },
    INFO: { name: "INFO", priority: 3, tlvMask: 0b01100 },
    WARN: { name: "WARN", priority: 4, tlvMask: 0b10000 },
    ERROR: { name: "ERROR", priority: 5, tlvMask: 0b10100 },
    FATAL: { name: "FATAL", priority: 6, tlvMask: 0b11000 },
  });
  let awsLambdaLogLevel =
    levels[
      process.env["AWS_LAMBDA_LOG_LEVEL"]?.toUpperCase() as keyof typeof levels
    ] ?? levels.TRACE;

  if (levels.TRACE.priority >= awsLambdaLogLevel.priority) {
    console.trace = (msg, ...params) => {
      log(levels.TRACE, msg, ...params);
    };
  } else {
    console.trace = NopLog;
  }
  if (levels.DEBUG.priority >= awsLambdaLogLevel.priority) {
    console.debug = (msg, ...params) => {
      log(levels.DEBUG, msg, ...params);
    };
  } else {
    console.debug = NopLog;
  }
  if (levels.INFO.priority >= awsLambdaLogLevel.priority) {
    console.info = (msg, ...params) => {
      log(levels.INFO, msg, ...params);
    };
  } else {
    console.info = NopLog;
  }
  console.log = console.info;
  if (levels.WARN.priority >= awsLambdaLogLevel.priority) {
    console.warn = (msg, ...params) => {
      log(levels.WARN, msg, ...params);
    };
  } else {
    console.warn = NopLog;
  }
  if (levels.ERROR.priority >= awsLambdaLogLevel.priority) {
    console.error = (msg, ...params) => {
      log(levels.ERROR, msg, ...params);
    };
  } else {
    console.error = NopLog;
  }
}
