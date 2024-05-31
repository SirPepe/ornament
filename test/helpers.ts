export const wait = (t = 0, x?: any) =>
  new Promise<any>((r) => setTimeout(() => r(x), t));

// Classes that extend HTMLElement must be registered as custom elements in
// order for us to be able to construct them. So we need a lot of element names.
let x = 0;
export const generateTagName = () => `test-element${x++}`;
