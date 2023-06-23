export const tick = () => new Promise<unknown>((r) => requestAnimationFrame(r));

export const wait = (t = 0) => new Promise<unknown>((r) => setTimeout(r, t));

export const noop = (...args: any[]): void => undefined;

// Classes that extend HTMLElement must be registered as custom elements in
// order for us to be able to construct them. So we need a lot of element names.
let x = 0;
export const generateTagName = () => `test-element${x++}`;
