export function disposable<T extends object>(
  init: () => T,
  cleanup: (resource: T) => void,
): T & { [Symbol.dispose]: () => void } {
  const resource = init();
  return Object.assign(resource, {
    [Symbol.dispose]: () => cleanup(resource),
  });
}
