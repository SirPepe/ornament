import { MetaMap } from "./lib";

const eventTargetMap = new MetaMap<HTMLElement, EventTarget>(
  () => new EventTarget(),
);

export function trigger<
  T extends HTMLElement,
  K extends keyof OrnamentEventMap,
>(instance: T, name: K, args: OrnamentEventMap[K]): void {
  eventTargetMap
    .get(instance)
    .dispatchEvent(Object.assign(new Event(name), args));
}

export function listen<T extends HTMLElement, K extends keyof OrnamentEventMap>(
  instance: T,
  name: K,
  callback: (this: T, args: Event & OrnamentEventMap[K]) => void,
  options?: AddEventListenerOptions,
): void {
  eventTargetMap
    .get(instance)
    .addEventListener(
      name,
      (evt: any): void => callback.call(instance, evt),
      options,
    );
}
