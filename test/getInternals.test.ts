import { expect } from "@esm-bundle/chai";
import { define, enhance, getInternals } from "../src/index.js";
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

    test("Using getInternals() in enhanced subclasses", () => {
      @enhance()
      class Base extends HTMLElement {}
      class Test extends Base {
        constructor() {
          super();
          getInternals(this);
        }
      }
      window.customElements.define(generateTagName(), Test);
      const testEl = new Test();
    });

    test("Using attachInternals() in enhanced subclasses", () => {
      @enhance()
      class Base extends HTMLElement {}
      class Test extends Base {
        constructor() {
          super();
          this.attachInternals();
        }
      }
      window.customElements.define(generateTagName(), Test);
      const testEl = new Test();
    });

    test("Using attachInternals() in a mixin in a decorator on a subclass", () => {
      function whatever() {
        return function (target: any) {
          @enhance()
          class Mixin extends target {}
          return Mixin;
        };
      }
      class Base extends HTMLElement {}
      @whatever()
      class Test extends Base {
        constructor() {
          super();
          this.attachInternals(); // <- Error
        }
      }
      window.customElements.define(generateTagName(), Test);
      const testEl = new Test();
    });
  });
});
