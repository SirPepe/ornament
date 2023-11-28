import { expect } from "@esm-bundle/chai";
import { spy } from "sinon";
import { listen, trigger, define, attr, string, prop } from "../src/index.js";
import { generateTagName } from "./helpers.js";
const test = it;

describe("Event bus", () => {
  describe("Basic functionality", () => {
    test("listen()", () => {
      const connectFn = spy();
      const disconnectFn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {}
      const instance = new Test();
      listen(instance, "connected", connectFn);
      listen(instance, "disconnected", disconnectFn);
      document.body.append(instance);
      instance.remove();
      expect(connectFn.callCount).to.equal(1);
      expect(disconnectFn.callCount).to.equal(1);
    });

    test("trigger()", () => {
      const connectFn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {}
      const instance = new Test();
      listen(instance, "connected", connectFn);
      trigger(instance, "connected");
      expect(connectFn.callCount).to.equal(1);
    });
  });

  describe("attr event", () => {
    test("fire for observed content attributes", () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string()) accessor foo = "";
      }
      const instance = new Test();
      listen(instance, "attr", fn);
      instance.setAttribute("foo", "a");
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql(["foo", null, "a"]);
      instance.setAttribute("foo", "b");
      expect(fn.callCount).to.equal(2);
      expect(fn.getCalls()[1].args).to.eql(["foo", "a", "b"]);
      instance.setAttribute("foo", "b");
      expect(fn.callCount).to.equal(3);
      expect(fn.getCalls()[2].args).to.eql(["foo", "b", "b"]);
      instance.removeAttribute("foo");
      expect(fn.callCount).to.equal(4);
      expect(fn.getCalls()[3].args).to.eql(["foo", "b", null]);
    });

    test("fire for observed, non-reflective content attributes", () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string(), { reflective: false }) accessor foo = "";
      }
      const instance = new Test();
      listen(instance, "attr", fn);
      instance.setAttribute("foo", "a");
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql(["foo", null, "a"]);
      instance.setAttribute("foo", "b");
      expect(fn.callCount).to.equal(2);
      expect(fn.getCalls()[1].args).to.eql(["foo", "a", "b"]);
      instance.setAttribute("foo", "b");
      expect(fn.callCount).to.equal(3);
      expect(fn.getCalls()[2].args).to.eql(["foo", "b", "b"]);
      instance.removeAttribute("foo");
      expect(fn.callCount).to.equal(4);
      expect(fn.getCalls()[3].args).to.eql(["foo", "b", null]);
    });
  });

  describe("prop event", () => {
    test("fire for idl attributes defined with @attr", () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string()) accessor foo = "";
      }
      const instance = new Test();
      listen(instance, "prop", fn);
      instance.foo = "a";
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql(["foo", "a"]);
      instance.foo = "b";
      expect(fn.callCount).to.equal(2);
      expect(fn.getCalls()[1].args).to.eql(["foo", "b"]);
      instance.foo = "b"; // no change
      expect(fn.callCount).to.equal(2);
    });

    test("fire for idl attributes defined with @prop", () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor foo = "";
      }
      const instance = new Test();
      listen(instance, "prop", fn);
      instance.foo = "a";
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql(["foo", "a"]);
      instance.foo = "b";
      expect(fn.callCount).to.equal(2);
      expect(fn.getCalls()[1].args).to.eql(["foo", "b"]);
      instance.foo = "b"; // no change
      expect(fn.callCount).to.equal(2);
    });

    test("fire for observed content attributes", () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string()) accessor foo = "";
      }
      const instance = new Test();
      listen(instance, "prop", fn);
      instance.setAttribute("foo", "a");
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql(["foo", "a"]);
      instance.setAttribute("foo", "b");
      expect(fn.callCount).to.equal(2);
      expect(fn.getCalls()[1].args).to.eql(["foo", "b"]);
      instance.setAttribute("foo", "b"); // no change
      expect(fn.callCount).to.equal(2);
      instance.removeAttribute("foo");
      expect(fn.callCount).to.equal(3);
      expect(fn.getCalls()[2].args).to.eql(["foo", ""]);
    });
  });
});
