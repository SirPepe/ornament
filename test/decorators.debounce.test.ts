import { expect } from "@esm-bundle/chai";
import { spy } from "sinon";
import { debounce, define } from "../src/index.js";
import { generateTagName, wait } from "./helpers.js";
const test = it;

describe("Decorators", () => {
  describe("@debounce", () => {
    test("debouncing class field functions", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        // Using timeout because RAF is unreliable in headless browsers
        @debounce({ fn: debounce.timeout(0) }) test = (x: number) =>
          fn(x, this);
      }
      const el = new Test();
      const func = el.test;
      el.test(1);
      el.test(2);
      func(3);
      await wait(100);
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql([3, el]);
    });

    test("debouncing private class field functions", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        // Using timeout because RAF is unreliable in headless browsers
        @debounce({ fn: debounce.timeout(0) }) #test = (x: number) =>
          fn(x, this);
        runTest() {
          this.#test(1);
          this.#test(2);
          this.#test(3);
        }
      }
      const el = new Test();
      el.runTest();
      await wait(100);
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql([3, el]);
    });

    test("debouncing class methods", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        // Using timeout because RAF is unreliable in headless browsers
        @debounce({ fn: debounce.timeout(0) }) test(x: number): number {
          fn(x, this);
          return x;
        }
      }
      const el = new Test();
      el.test(1);
      el.test(2);
      el.test(3);
      await wait(100);
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql([3, el]);
    });

    test("debouncing private class methods", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        // Using timeout because RAF is unreliable in headless browsers
        @debounce({ fn: debounce.timeout(0) }) #test(x: number): number {
          fn(x, this);
          return x;
        }
        test(x: number): void {
          this.#test(x);
        }
      }
      const el = new Test();
      el.test(1);
      el.test(2);
      el.test(3);
      await wait(100);
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql([3, el]);
    });

    test("access to private fields", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        #foo = 42;
        // Using timeout because RAF is unreliable in headless browsers
        @debounce({ fn: debounce.timeout(0) }) #test(x: number): number {
          fn(x, this.#foo, this);
          return x;
        }
        test(x: number): void {
          this.#test(x);
        }
      }
      const el = new Test();
      el.test(1);
      el.test(2);
      el.test(3);
      await wait(100);
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql([3, 42, el]);
    });

    test("debouncing static class methods", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        // Using timeout because RAF is unreliable in headless browsers
        @debounce({ fn: debounce.timeout(0) })
        static test(x: number): void {
          fn(x, this);
        }
      }
      Test.test(1);
      Test.test(2);
      Test.test(3);
      await wait(100);
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql([3, Test]);
    });

    test("debouncing static class field functions", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        // Using timeout because RAF is unreliable in headless browsers
        @debounce({ fn: debounce.timeout(0) }) static test = (
          x: number,
        ): void => fn(x, this);
      }
      Test.test(1);
      Test.test(2);
      Test.test(3);
      await wait(100);
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql([3, Test]);
    });
  });
});
