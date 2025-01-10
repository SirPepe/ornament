import { expect } from "@esm-bundle/chai";
import { define, getInternals } from "../src/index.js";
import { generateTagName } from "./helpers.js";
const test = it;

describe("getInternals()", () => {
  describe("Basic functionality", () => {
    test("calling getInternals() first", () => {
      @define(generateTagName())
      class Test extends HTMLElement {}
      const testEl = new Test();
      const internals1 = getInternals(testEl);
      const internals2 = testEl.attachInternals();
      expect(internals1).to.equal(internals2);
      const internals3 = getInternals(testEl);
      expect(internals1).to.equal(internals3);
      expect(() => testEl.attachInternals()).to.throw();
    });

    test("calling attachInternals() first", () => {
      @define(generateTagName())
      class Test extends HTMLElement {}
      const testEl = new Test();
      const internals1 = testEl.attachInternals();
      const internals2 = getInternals(testEl);
      expect(internals1).to.equal(internals2);
      const internals3 = getInternals(testEl);
      expect(internals1).to.equal(internals3);
      expect(() => testEl.attachInternals()).to.throw();
    });
  });
});
