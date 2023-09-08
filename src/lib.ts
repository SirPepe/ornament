export const Nil: unique symbol = Symbol();

export const identity = <T>(x: T) => x;

export class MetaMap<K extends object, V extends object> {
  #initValue: () => V;
  #backend = new WeakMap<K, V>();

  constructor(initValue: () => V) {
    this.#initValue = initValue;
  }

  get(key: K): V {
    let value = this.#backend.get(key);
    if (value) {
      return value;
    }
    value = this.#initValue();
    this.#backend.set(key, value);
    return value;
  }
}
