// Trigger and listener functions simply slap event targets onto the instances
// as needed, because some event bus functionality is required even before the
// instances themselves have initialized completely. Lazy initialization is the
// only way this can work.

import { EVENT_BUS_TARGET } from "./lib";

export class OrnamentEvent<K extends keyof OrnamentEventMap> extends Event {
  readonly args: OrnamentEventMap[K];
  constructor(name: K, args: OrnamentEventMap[K]) {
    super(name);
    this.args = args;
  }
}

export function trigger<
  T extends HTMLElement,
  K extends keyof OrnamentEventMap,
>(instance: T, name: K, ...args: OrnamentEventMap[K]): void {
  const target = ((instance as any)[EVENT_BUS_TARGET] ??= new EventTarget());
  target.dispatchEvent(new OrnamentEvent(name, args));
}

export function listen<T extends HTMLElement, K extends keyof OrnamentEventMap>(
  instance: T,
  name: K,
  callback: (this: T, ...args: OrnamentEventMap[K]) => void,
  options?: AddEventListenerOptions,
): void {
  const target = ((instance as any)[EVENT_BUS_TARGET] ??= new EventTarget());
  target.addEventListener(
    name,
    (evt: any): void => callback.call(instance, ...evt.args),
    options,
  );
}
