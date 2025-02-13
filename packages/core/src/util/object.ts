export function objectFlatten(
  obj: Record<string, any>,
  prefix: string = "",
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const newKey = prefix
      ? prefix + (Array.isArray(obj) ? `[${key}]` : `.${key}`)
      : key;

    if (value === null || value === undefined) {
      result[newKey] = value;
      continue;
    }

    if (typeof value === "object") {
      Object.assign(result, objectFlatten(value, newKey));
      continue;
    }

    result[newKey] = value;
  }

  return result;
}
