import { expect } from "@esm-bundle/chai";
import { spy } from "sinon";
import {
  attr,
  debounce,
  define,
  prop,
  reactive,
  json,
  number,
  string,
  init,
} from "../src/index.js";
import { generateTagName, wait } from "./helpers.js";
const test = it;

describe("Decorators", () => {
  describe("@reactive", () => {
    test("method runs on prop change", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        @reactive() test() {
          fn(this.x);
        }
      }
      const el = new Test();
      el.x = "B";
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql(["B"]);
    });

    test("class field function runs on prop change", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        @reactive() test = () => fn(this.x);
      }
      const el = new Test();
      el.x = "B";
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql(["B"]);
    });

    test("prop changes in the constructor cause no reaction", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        constructor() {
          super();
          this.x = "B";
        }
        @reactive() test() {
          fn(this.x);
        }
      }
      const el = new Test();
      el.x = "C";
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql(["C"]);
    });

    test("two prop changes", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        @prop(string()) accessor y = "Z";
        @reactive() test() {
          fn(this.x, this.y);
        }
      }
      const el = new Test();
      el.x = "B";
      el.y = "Y";
      expect(fn.callCount).to.equal(2);
      expect(fn.getCalls()[0].args).to.eql(["B", "Z"]);
      expect(fn.getCalls()[1].args).to.eql(["B", "Y"]);
    });

    test("multiple prop changes with the same value only cause one effect to run", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        @reactive() test() {
          fn(this.x);
        }
      }
      const el = new Test();
      el.x = "B";
      el.x = "B";
      el.x = "B";
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql(["B"]);
    });

    test("multiple attr changes with the same value only cause one effect to run (primitives)", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string()) accessor x = "A";
        @reactive() test() {
          fn(this.x);
        }
      }
      const el = new Test();
      el.x = "B";
      el.x = "B";
      el.x = "B";
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql(["B"]);
    });

    test("attr change causes only one effect to run, not also the attributeChangedCallback (objects)", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(json()) accessor x = [1];
        @reactive() test() {
          fn(this.x);
        }
      }
      const el = new Test();
      el.x = [2];
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql([[2]]);
    });

    test("attr change causes only one effect to run, not also the attributeChangedCallback (two primitive updates)", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string()) accessor foo = "a";
        @attr(string()) accessor bar = "x";
        @reactive() test() {
          fn(this.foo, this.bar);
        }
      }
      const el = new Test();
      el.foo = "b";
      el.bar = "y";
      expect(fn.callCount).to.equal(2);
      expect(fn.getCalls()[0].args).to.eql(["b", "x"]);
      expect(fn.getCalls()[1].args).to.eql(["b", "y"]);
    });

    test("predicate option", async () => {
      const testFn = spy();
      const predFn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(number()) accessor value = 0;
        @reactive({
          predicate: (instance, key, value) => {
            predFn(instance, key, value);
            return instance.value % 2 === 0;
          },
        })
        test() {
          testFn(this.value);
        }
      }
      const el = new Test();
      el.value++;
      expect(testFn.callCount).to.equal(0);
      expect(predFn.callCount).to.equal(1);
      expect(predFn.getCalls()[0].args).to.eql([el, "value", 1]);
      el.value++;
      expect(testFn.callCount).to.equal(1);
      expect(testFn.getCalls()[0].args).to.eql([2]);
      expect(predFn.callCount).to.equal(2);
      expect(predFn.getCalls()[1].args).to.eql([el, "value", 2]);
      el.value++;
      expect(testFn.callCount).to.equal(1);
      expect(predFn.callCount).to.equal(3);
      expect(predFn.getCalls()[2].args).to.eql([el, "value", 3]);
      el.value++;
      expect(testFn.callCount).to.equal(2);
      expect(testFn.getCalls()[1].args).to.eql([4]);
      expect(predFn.callCount).to.equal(4);
      expect(predFn.getCalls()[3].args).to.eql([el, "value", 4]);
    });

    test("static class member as a predicate (for accessing a private field)", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(number()) accessor #value = 0;
        static triggerReactive(instance: Test): boolean {
          return instance.#value % 2 === 0;
        }
        @reactive({
          predicate: (instance) => Test.triggerReactive(instance),
        })
        test() {
          fn(this.#value);
        }
        update() {
          this.#value++;
        }
      }
      const el = new Test();
      el.update();
      expect(fn.callCount).to.equal(0);
      el.update();
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql([2]);
      el.update();
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql([2]);
      el.update();
      expect(fn.callCount).to.equal(2);
      expect(fn.getCalls()[0].args).to.eql([2]);
      expect(fn.getCalls()[1].args).to.eql([4]);
    });

    test("keys option", async () => {
      const fnX = spy();
      const fnY = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        @prop(string()) accessor y = "Z";
        @reactive({ keys: ["x"] }) testX() {
          fnX(this.x, this.y);
        }
        @reactive({ keys: ["y"] }) testY() {
          fnY(this.x, this.y);
        }
      }
      const el = new Test();
      el.x = "B";
      expect(fnX.callCount).to.equal(1);
      expect(fnX.getCalls()[0].args).to.eql(["B", "Z"]);
      expect(fnY.callCount).to.equal(0);
      el.y = "Y";
      expect(fnX.callCount).to.equal(1);
      expect(fnX.getCalls()[0].args).to.eql(["B", "Z"]);
      expect(fnY.callCount).to.equal(1);
      expect(fnY.getCalls()[0].args).to.eql(["B", "Y"]);
    });

    test("keys option with private names", async () => {
      const fnX = spy();
      const fnY = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor #x = "A";
        @prop(string()) accessor y = "Z";
        setX(value: string): void {
          this.#x = value;
        }
        @reactive({ keys: ["#x"] }) testX() {
          fnX(this.#x, this.y);
        }
        @reactive({ keys: ["y"] }) testY() {
          fnY(this.#x, this.y);
        }
      }
      const el = new Test();
      el.setX("B");
      expect(fnX.callCount).to.equal(1);
      expect(fnX.getCalls()[0].args).to.eql(["B", "Z"]);
      expect(fnY.callCount).to.equal(0);
      el.y = "Y";
      expect(fnX.callCount).to.equal(1);
      expect(fnX.getCalls()[0].args).to.eql(["B", "Z"]);
      expect(fnY.callCount).to.equal(1);
      expect(fnY.getCalls()[0].args).to.eql(["B", "Y"]);
    });

    test("attribute changes via setter trigger @reactive", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string()) accessor x = "A";
        @reactive() test() {
          fn(this.x);
        }
      }
      const el = new Test();
      el.x = "B";
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql(["B"]);
    });

    test("attributes changes via setAttribute trigger @reactive", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string()) accessor x = "A";
        @reactive() test() {
          fn(this.x);
        }
      }
      const el = new Test();
      el.setAttribute("x", "B");
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql(["B"]);
    });

    test("access to private fields", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        #foo = 42;
        @prop(string()) accessor x = "A";
        @reactive() test() {
          fn(this.x, this.#foo);
        }
      }
      const el = new Test();
      el.x = "B";
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql(["B", 42]);
    });

    test("on a base class", async () => {
      const fn = spy();
      class Base extends HTMLElement {
        @reactive() test() {
          fn();
        }
      }
      @define(generateTagName())
      class Test extends Base {
        @prop(number()) accessor foo = 42;
      }
      const el = new Test();
      el.foo = 23;
      expect(fn.callCount).to.equal(1);
    });

    test("reject on static methods", async () => {
      expect(() => {
        class Test extends HTMLElement {
          // @ts-expect-error for testing runtime checks
          @reactive() static test() {
            return;
          }
        }
      }).to.throw(TypeError);
    });
  });

  describe("@reactive + @debounce", () => {
    test("debounced reactive method", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        @reactive()
        // Using timeout because RAF is unreliable in headless browsers
        @debounce({ fn: debounce.timeout(0) })
        test() {
          fn(this.x);
        }
      }
      const el = new Test();
      el.x = "B";
      el.x = "C";
      el.x = "D";
      await wait(25);
      expect(fn.callCount).to.equal(1); // only one update
      expect(fn.getCalls()[0].args).to.eql(["D"]);
    });

    test("debounced reactive class field function", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        @reactive()
        // Using timeout because RAF is unreliable in headless browsers
        @debounce({ fn: debounce.timeout(0) })
        test = () => fn(this.x);
      }
      const el = new Test();
      el.x = "B";
      el.x = "C";
      el.x = "D";
      await wait(25);
      expect(fn.callCount).to.equal(1); // only one update
      expect(fn.getCalls()[0].args).to.eql(["D"]);
    });
  });

  describe("@reactive + @init + @debounce", () => {
    test("debounced reactive init method", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        @reactive()
        // Using timeout because RAF is unreliable in headless browsers
        @debounce({ fn: debounce.timeout(0) })
        @init()
        test() {
          fn(this.x);
        }
      }
      const el = new Test();
      el.x = "B";
      el.x = "C";
      el.x = "D";
      expect(fn.callCount).to.equal(1); // initial
      expect(fn.getCalls()[0].args).to.eql(["A"]);
      await wait(25);
      expect(fn.callCount).to.equal(2); // initial + one update
      expect(fn.getCalls()[1].args).to.eql(["D"]);
    });

    test("debounced reactive init class field function", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        @reactive()
        // Using timeout because RAF is unreliable in headless browsers
        @debounce({ fn: debounce.timeout(0) })
        @init()
        test = () => fn(this.x);
      }
      const el = new Test();
      el.x = "B";
      el.x = "C";
      el.x = "D";
      expect(fn.callCount).to.equal(1); // initial
      expect(fn.getCalls()[0].args).to.eql(["A"]);
      await wait(25);
      expect(fn.callCount).to.equal(2); // initial + one update
      expect(fn.getCalls()[1].args).to.eql(["D"]);
    });
  });
});
