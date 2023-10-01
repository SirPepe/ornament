const targetMap = new WeakMap<HTMLElement, EventTarget>();

export function trigger<
  T extends HTMLElement,
  K extends keyof OrnamentEventMap,
>(instance: T, name: K, args: OrnamentEventMap[K]): void {
  let target = targetMap.get(instance);
  if (!target) {
    targetMap.set(instance, (target = new EventTarget()));
  }
  target.dispatchEvent(Object.assign(new Event(name), args));
}

export function listen<T extends HTMLElement, K extends keyof OrnamentEventMap>(
  instance: T,
  name: K,
  callback: (this: T, args: Event & OrnamentEventMap[K]) => void,
  options?: AddEventListenerOptions,
): void {
  let target = targetMap.get(instance);
  if (!target) {
    targetMap.set(instance, (target = new EventTarget()));
  }
  target.addEventListener(
    name,
    (evt: any): void => callback.call(instance, evt),
    options,
  );
}
