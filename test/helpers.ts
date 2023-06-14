export const tick = () => new Promise<unknown>((r) => requestAnimationFrame(r));

// Classes that extend HTMLElement must be registered as custom elements in
// order for us to be able to construct them. So we need a lot of element names.
let x = 0;
export const generateTagName = () => `test-element${x++}`;
