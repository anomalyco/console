export function logger(tags?: Record<string, any>) {
  tags = tags || {};

  return {
    info(message?: any, ...optionalParams: any[]) {
      const prefix = Object.entries(tags)
        .map(([key, value]) => `${key}=${value}`)
        .join(" ");
      console.log(prefix, message, ...optionalParams);
    },
    tag(key: string, value: string) {
      tags[key] = value;
    },
    clone() {
      return logger({ ...tags });
    },
  };
}
