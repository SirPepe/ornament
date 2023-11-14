import { METADATA_KEY } from "./global";

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
  let target = window[METADATA_KEY].targetMap.get(instance);
  if (!target) {
    window[METADATA_KEY].targetMap.set(instance, (target = new EventTarget()));
  }
  target.dispatchEvent(new OrnamentEvent(name, args));
}

export function listen<T extends HTMLElement, K extends keyof OrnamentEventMap>(
  instance: T,
  name: K,
  callback: (this: T, ...args: OrnamentEventMap[K]) => void,
  options?: AddEventListenerOptions,
): void {
  let target = window[METADATA_KEY].targetMap.get(instance);
  if (!target) {
    window[METADATA_KEY].targetMap.set(instance, (target = new EventTarget()));
  }
  target.addEventListener(
    name,
    (evt: any): void => callback.call(instance, ...evt.args),
    options,
  );
}
