// This does not test timeout.raf because that's unreliable in headless browsers

import { expect } from "@esm-bundle/chai";
import { spy } from "sinon";
import { debounce } from "../src/index.js";
import { wait } from "./helpers.js";
const test = it;

describe("Debouncing functions", () => {
  describe("timeout", () => {
    test("debouncing a function", async () => {
      const fn = spy();
      const that = {};
      const debounced = debounce.timeout(100)(fn);
      debounced.call(that, 1);
      debounced.call(that, 2);
      debounced.call(that, 3);
      expect(fn.callCount).to.equal(0);
      await wait(150);
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql([3]);
      expect(fn.getCalls()[0].thisValue).to.eql(that);
    });

    test("debouncing separately for different 'this' values", async () => {
      const fn = spy();
      const that1 = {};
      const that2 = {};
      const debounced = debounce.timeout(100)(fn);
      debounced.call(that1, 1);
      debounced.call(that2, "a");
      debounced.call(that1, 2);
      debounced.call(that1, 3);
      debounced.call(that2, "b");
      expect(fn.callCount).to.equal(0);
      await wait(150);
      expect(fn.callCount).to.equal(2);
      expect(fn.getCalls()[0].args).to.eql([3]);
      expect(fn.getCalls()[0].thisValue).to.eql(that1);
      expect(fn.getCalls()[1].args).to.eql(["b"]);
      expect(fn.getCalls()[1].thisValue).to.eql(that2);
    });
  });

  describe("asap", () => {
    test("debouncing a function", async () => {
      const fn = spy();
      const that = {};
      const debounced = debounce.asap()(fn);
      debounced.call(that, 1);
      debounced.call(that, 2);
      debounced.call(that, 3);
      expect(fn.callCount).to.equal(0);
      return Promise.resolve().then(() => {
        expect(fn.callCount).to.equal(1);
        expect(fn.getCalls()[0].args).to.eql([3]);
        expect(fn.getCalls()[0].thisValue).to.eql(that);
      });
    });

    test("debouncing separately for different 'this' values", async () => {
      const fn = spy();
      const that1 = {};
      const that2 = {};
      const debounced = debounce.asap()(fn);
      debounced.call(that1, 1);
      debounced.call(that2, "a");
      debounced.call(that1, 2);
      debounced.call(that1, 3);
      debounced.call(that2, "b");
      expect(fn.callCount).to.equal(0);
      return Promise.resolve().then(() => {
        expect(fn.callCount).to.equal(2);
        expect(fn.getCalls()[0].args).to.eql([3]);
        expect(fn.getCalls()[0].thisValue).to.eql(that1);
        expect(fn.getCalls()[1].args).to.eql(["b"]);
        expect(fn.getCalls()[1].thisValue).to.eql(that2);
      });
    });
  });
});
