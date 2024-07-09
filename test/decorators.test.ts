import { expect } from "@esm-bundle/chai";
import { spy } from "sinon";
import {
  adopted,
  attr,
  connected,
  debounce,
  define,
  disconnected,
  enhance,
  formAssociated,
  formDisabled,
  formReset,
  prop,
  reactive,
  subscribe,
  href,
  json,
  number,
  string,
  init,
  trigger,
} from "../src/index.js";
import { generateTagName, wait } from "./helpers.js";
import { signal } from "@preact/signals-core";
const test = it;

describe("Decorators", () => {
  describe("@enhance", () => {
    test("upgrade class", () => {
      @enhance()
      class Test extends HTMLElement {}
      expect(
        Boolean((Test as any).prototype.attributeChangedCallback),
      ).to.equal(true);
    });
  });

  describe("@define", () => {
    test("register element", () => {
      const name = generateTagName();
      @define(name)
      class Test extends HTMLElement {}
      expect(window.customElements.get(name)).to.equal(Test);
      expect(document.createElement(name)).to.be.instanceOf(Test);
    });

    test("reject invalid tag names", () => {
      expect(() => {
        @define("")
        class Test extends HTMLElement {}
      }).to.throw();
      expect(() => {
        @define("invalid")
        class Test extends HTMLElement {}
      }).to.throw();
      expect(() => {
        @define(undefined as any)
        class Test extends HTMLElement {}
      }).to.throw();
    });
  });

  describe("@prop", () => {
    test("register property", () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
      }
      const el = new Test();
      expect(el.x).to.equal("A");
      expect(el.getAttribute("x")).to.equal(null);
      el.x = "B";
      expect(el.x).to.equal("B");
      expect(el.getAttribute("x")).to.equal(null);
    });

    test("register private property", () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor #x = "A";
        testSet(value: string): void {
          this.#x = value;
        }
        testGet(): string {
          return this.#x;
        }
      }
      const el = new Test();
      el.testSet("B");
      expect(el.testGet()).to.equal("B");
    });

    test("register symbol property", () => {
      const key = Symbol();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor [key] = "A";
      }
      const el = new Test();
      el[key] = "B";
      expect(el[key]).to.equal("B");
    });

    test("accessor is resistant against clobbering", async () => {
      const tagName = generateTagName();
      // Clobber x before the element has been defined
      const el = document.createElement(tagName);
      (el as any).x = "X";
      // Create the element definition
      @define(tagName)
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
      }
      // Upgrade and test the instance
      window.customElements.upgrade(el);
      expect(Object.hasOwn(el, "x")).to.equal(false);
      expect((el as any).x).to.equal("X");
    });

    test("reject invalid initial values", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(number({ min: 0 })) accessor x = -7;
      }
      expect(() => new Test()).to.throw(RangeError);
    });

    test("reject on static", () => {
      expect(() => {
        @define(generateTagName())
        class Test extends HTMLElement {
          // @ts-expect-error for testing runtime checks
          @prop(string()) static accessor foo = "A";
        }
      }).to.throw(TypeError);
    });
  });

  describe("@attr", () => {
    test("register attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string()) accessor x = "A";
      }
      const el = new Test();
      expect(el.x).to.equal("A");
      expect(el.getAttribute("x")).to.equal(null);
      el.x = "B";
      expect(el.x).to.equal("B");
      expect(el.getAttribute("x")).to.equal("B");
      el.setAttribute("x", "C");
      expect(el.x).to.equal("C");
      expect(el.getAttribute("x")).to.equal("C");
    });

    test("user-defined attribute handling keeps working", async () => {
      const userDefinedCallback = spy();
      const reactiveCallback = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string()) accessor x = "A";
        static get observedAttributes(): string[] {
          return ["y"];
        }
        attributeChangedCallback(name: string): void {
          userDefinedCallback(this, name);
        }
        @reactive() test() {
          reactiveCallback(this);
        }
      }
      const el = new Test();
      el.setAttribute("x", "B");
      el.setAttribute("y", "B");
      expect(userDefinedCallback.callCount).to.equal(1);
      expect(userDefinedCallback.getCalls()[0].args).to.eql([el, "y"]);
      expect(reactiveCallback.callCount).to.equal(1);
      expect(reactiveCallback.getCalls()[0].args).to.eql([el]);
    });

    test("no cross-instance effects", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(href()) accessor x = "";
      }
      const el1 = new Test();
      const el2 = new Test();
      expect(el1.x).to.equal("");
      expect(el2.x).to.equal("");
      el1.x = window.location.href;
      expect(el1.x).to.equal(window.location.href);
      expect(el2.x).to.equal("");
    });

    test("initialize attribute value", async () => {
      const tagName = generateTagName();
      @define(tagName)
      class Test extends HTMLElement {
        @attr(string()) accessor x = "A";
      }
      const container = document.createElement("div");
      container.innerHTML = `<${tagName} x="B"></${tagName}>`;
      expect((container.children[0] as any).x).to.equal("B");
    });

    test("Non-reflective attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string(), { reflective: false }) accessor x = "A";
      }
      const el = new Test();
      expect(el.x).to.equal("A");
      expect(el.getAttribute("x")).to.equal(null);
      el.x = "B";
      expect(el.x).to.equal("B");
      expect(el.getAttribute("x")).to.equal(null);
      el.setAttribute("x", "C");
      expect(el.x).to.equal("B");
      expect(el.getAttribute("x")).to.equal("C");
    });

    test("custom attribute name via 'as'", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string(), { as: "y" }) accessor x = "A";
      }
      const el = new Test();
      expect(el.x).to.equal("A");
      expect(el.getAttribute("y")).to.equal(null);
      el.x = "B";
      expect(el.x).to.equal("B");
      expect(el.getAttribute("y")).to.equal("B");
      el.setAttribute("y", "C");
      expect(el.x).to.equal("C");
      expect(el.getAttribute("y")).to.equal("C");
    });

    test("late upgrade", async () => {
      const tagName = generateTagName();
      const el: any = document.createElement(tagName);
      el.setAttribute("x", "B");
      @define(tagName)
      class Test extends HTMLElement {
        @attr(string()) accessor x = "A";
      }
      window.customElements.upgrade(el);
      expect(el.x).to.equal("B");
      el.removeAttribute("x");
      expect(el.x).to.equal("A");
    });

    test("accessor is resistant against clobbering", async () => {
      const tagName = generateTagName();
      // Clobber x before the element has been defined
      const el = document.createElement(tagName);
      (el as any).x = "X";
      // Create the element definition
      @define(tagName)
      class Test extends HTMLElement {
        @attr(string()) accessor x = "A";
      }
      // Upgrade and test the instance
      window.customElements.upgrade(el);
      expect(Object.hasOwn(el, "x")).to.equal(false);
      expect((el as any).x).to.equal("X");
    });

    test("un-clobbering gives precedence to attribute values", async () => {
      const tagName = generateTagName();
      // Clobber x before the element has been defined
      const el = document.createElement(tagName);
      (el as any).x = "X";
      el.setAttribute("x", "Y");
      // Create the element definition
      @define(tagName)
      class Test extends HTMLElement {
        @attr(string()) accessor x = "A";
      }
      // Upgrade and test the instance
      window.customElements.upgrade(el);
      expect(Object.hasOwn(el, "x")).to.equal(false);
      expect((el as any).x).to.equal("Y");
    });

    test("reject invalid initial values", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(number({ min: 0 })) accessor x = -7;
      }
      expect(() => new Test()).to.throw(RangeError);
    });

    test("reject on symbol fields without a name for a public facade", async () => {
      expect(() => {
        const key = Symbol();
        class Test extends HTMLElement {
          @attr(string()) accessor [key] = "A";
        }
      }).to.throw(TypeError);
    });

    test("reject on symbol fields without a public facade", async () => {
      const key = Symbol();
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string(), { as: "x" }) accessor [key] = "A";
      }
      // checks happen on accessor init at the earliest
      expect(() => new Test()).to.throw(TypeError);
    });

    test("works with symbol fields with a public facade", async () => {
      const key = Symbol();
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string(), { as: "x" }) accessor [key] = "A";
        get x() {
          return this[key];
        }
        set x(value: string) {
          this[key] = value;
        }
      }
      const el = new Test();
      expect(el.x).to.equal("A");
      el.x = "B";
      expect(el.x).to.equal("B");
      expect(el[key]).to.equal("B");
      expect(el.getAttribute("x")).to.equal("B");
      el.setAttribute("x", "C");
      expect(el.x).to.equal("C");
      expect(el[key]).to.equal("C");
    });

    test("rejects on private fields without a name for a public facade", async () => {
      expect(() => {
        @define(generateTagName())
        class Test extends HTMLElement {
          @attr(string()) accessor #x = "A";
        }
      }).to.throw(TypeError);
    });

    test("rejects on private fields without a public facade", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string(), { as: "y" }) accessor #x = "A";
      }
      // checks happen on accessor init at the earliest
      expect(() => new Test()).to.throw(TypeError);
    });

    test("works with private fields with a public facade", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string(), { as: "x" }) accessor #x = "A";
        get x() {
          return this.#x;
        }
        set x(value: string) {
          this.#x = value;
        }
      }
      const el = new Test();
      expect(el.x).to.equal("A");
      el.x = "B";
      expect(el.x).to.equal("B");
      expect(el.getAttribute("x")).to.equal("B");
      el.setAttribute("x", "C");
      expect(el.x).to.equal("C");
    });

    test("reject on static fields", async () => {
      expect(() => {
        class Test extends HTMLElement {
          // @ts-expect-error for testing runtime checks
          @attr(string()) static accessor x = "A";
        }
      }).to.throw(TypeError);
    });
  });

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

  describe("@connected/@disconnected", () => {
    test("methods fire on (dis)connect", async () => {
      const connectFn = spy();
      const disconnectFn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @connected() connected() {
          connectFn(this);
        }
        @disconnected() disconnected() {
          disconnectFn(this);
        }
      }
      const instance = new Test();
      document.body.append(instance);
      instance.remove();
      expect(connectFn.callCount).to.equal(1);
      expect(connectFn.getCalls()[0].args).to.eql([instance]);
      expect(disconnectFn.callCount).to.equal(1);
      expect(disconnectFn.getCalls()[0].args).to.eql([instance]);
    });

    test("field functions fire on (dis)connect", async () => {
      const connectFn = spy();
      const disconnectFn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @connected() connected = () => connectFn(this);
        @disconnected() disconnected = () => disconnectFn(this);
      }
      const instance = new Test();
      document.body.append(instance);
      instance.remove();
      expect(connectFn.callCount).to.equal(1);
      expect(connectFn.getCalls()[0].args).to.eql([instance]);
      expect(disconnectFn.callCount).to.equal(1);
      expect(disconnectFn.getCalls()[0].args).to.eql([instance]);
    });

    test("fail on non-functions type fields", async () => {
      expect(() => {
        @define(generateTagName())
        class Test extends HTMLElement {
          @connected() connected: any = 42;
        }
        new Test();
      }).to.throw();
    });

    test("no duplicate registration from multiple instances", async () => {
      const connectFn = spy();
      const disconnectFn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @connected() connected() {
          connectFn(this);
        }
        @disconnected() disconnected() {
          disconnectFn(this);
        }
      }
      const instance = new Test();
      const instance2 = new Test();
      document.body.append(instance);
      instance.remove();
      expect(connectFn.callCount).to.equal(1);
      expect(connectFn.getCalls()[0].args).to.eql([instance]);
      expect(disconnectFn.callCount).to.equal(1);
      expect(disconnectFn.getCalls()[0].args).to.eql([instance]);
    });

    test("fire on (dis)connect with access to private fields", async () => {
      const connectFn = spy();
      const disconnectFn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        #test = 42;
        @connected() connected() {
          connectFn(this, this.#test);
        }
        @disconnected() disconnected() {
          disconnectFn(this, this.#test);
        }
      }
      const instance = new Test();
      document.body.append(instance);
      instance.remove();
      expect(connectFn.callCount).to.equal(1);
      expect(connectFn.getCalls()[0].args).to.eql([instance, 42]);
      expect(disconnectFn.callCount).to.equal(1);
      expect(disconnectFn.getCalls()[0].args).to.eql([instance, 42]);
    });

    test("fire private method on connect with access to private fields when already connected", async () => {
      const connectFn = spy();
      const tagName = generateTagName();
      const instance = document.createElement(tagName);
      document.body.append(instance);
      @define(tagName)
      class Test extends HTMLElement {
        #test = 42;
        @connected() #connected() {
          connectFn(this, this.#test);
        }
      }
      expect(connectFn.callCount).to.equal(1);
      expect(connectFn.getCalls()[0].args).to.eql([instance, 42]);
    });
  });

  describe("@adopted", () => {
    test("fire methods on adoption", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @adopted() adopted() {
          fn(this);
        }
      }
      const instance = new Test();
      new Document().adoptNode(instance);
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql([instance]);
    });

    test("fire field functions on adoption", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @adopted() adopted = () => fn(this);
      }
      const instance = new Test();
      new Document().adoptNode(instance);
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql([instance]);
    });

    test("also fires the original adoptedCallback on adoption", async () => {
      const fn1 = spy();
      const fn2 = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @adopted() adopted() {
          fn1(this);
        }
        adoptedCallback() {
          fn2(this);
        }
      }
      const instance = new Test();
      new Document().adoptNode(instance);
      expect(fn1.callCount).to.equal(1);
      expect(fn1.getCalls()[0].args).to.eql([instance]);
      expect(fn2.callCount).to.equal(1);
      expect(fn2.getCalls()[0].args).to.eql([instance]);
    });
  });

  describe("@formAssociated", () => {
    test("fire methods on form association", async () => {
      const decoratedSpy = spy();
      const lifecycleCallbackSpy = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        static formAssociated = true;
        formAssociatedCallback(owner: HTMLFormElement | null): void {
          lifecycleCallbackSpy(this, owner);
        }
        @formAssociated() associated(owner: HTMLFormElement | null): void {
          decoratedSpy(this, owner);
        }
      }
      const instance = new Test();
      const form = document.createElement("form");
      new Document().append(form);
      form.append(instance);
      expect(decoratedSpy.callCount).to.equal(1);
      expect(decoratedSpy.getCalls()[0].args).to.eql([instance, form]);
      instance.remove();
      expect(decoratedSpy.callCount).to.equal(2);
      expect(decoratedSpy.getCalls()[1].args).to.eql([instance, null]);
      // Ensure the base lifecycle callback gets called properly
      expect(decoratedSpy.callCount).to.equal(lifecycleCallbackSpy.callCount);
      expect(decoratedSpy.getCalls().map(({ args }) => args)).to.eql(
        lifecycleCallbackSpy.getCalls().map(({ args }) => args),
      );
    });

    test("fire field functions on form association", async () => {
      const decoratedSpy = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        static formAssociated = true;
        @formAssociated() associated = (owner: HTMLFormElement | null) =>
          decoratedSpy(this, owner);
      }
      const instance = new Test();
      const form = document.createElement("form");
      new Document().append(form);
      form.append(instance);
      expect(decoratedSpy.callCount).to.equal(1);
      expect(decoratedSpy.getCalls()[0].args).to.eql([instance, form]);
      instance.remove();
      expect(decoratedSpy.callCount).to.equal(2);
      expect(decoratedSpy.getCalls()[1].args).to.eql([instance, null]);
    });
  });

  describe("@formReset", () => {
    test("fire methods on form reset", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        static formAssociated = true;
        @formReset() reset() {
          fn(this);
        }
      }
      const instance = new Test();
      const form = document.createElement("form");
      document.body.append(form);
      form.append(instance);
      form.reset();
      await wait(); // The reset algorithm is async
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql([instance]);
      document.body.removeChild(form);
    });

    test("fire field functions on form reset", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        static formAssociated = true;
        @formReset() reset = () => fn(this);
      }
      const instance = new Test();
      const form = document.createElement("form");
      document.body.append(form);
      form.append(instance);
      form.reset();
      await wait(); // The reset algorithm is async
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql([instance]);
      document.body.removeChild(form);
    });
  });

  describe("@formDisabled", () => {
    test("fire methods on fieldset disable", async () => {
      const decoratedSpy = spy();
      const lifecycleCallbackSpy = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        static formAssociated = true;
        formDisabledCallback(state: boolean): void {
          lifecycleCallbackSpy(this, state);
        }
        @formDisabled() disable(state: boolean): void {
          decoratedSpy(this, state);
        }
      }
      const instance = new Test();
      const form = document.createElement("form");
      const fieldset = document.createElement("fieldset");
      new Document().append(form);
      form.append(fieldset);
      fieldset.append(instance);
      expect(decoratedSpy.callCount).to.equal(0);
      fieldset.disabled = true;
      expect(decoratedSpy.callCount).to.equal(1);
      expect(decoratedSpy.getCalls()[0].args).to.eql([instance, true]);
      fieldset.disabled = false;
      expect(decoratedSpy.callCount).to.equal(2);
      expect(decoratedSpy.getCalls()[1].args).to.eql([instance, false]);
      // Ensure the base lifecycle callback gets called properly
      expect(decoratedSpy.callCount).to.equal(lifecycleCallbackSpy.callCount);
      expect(decoratedSpy.getCalls().map(({ args }) => args)).to.eql(
        lifecycleCallbackSpy.getCalls().map(({ args }) => args),
      );
    });

    test("fire class fields on fieldset disable", async () => {
      const decoratedSpy = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        static formAssociated = true;
        @formDisabled() disable = (state: boolean) => decoratedSpy(this, state);
      }
      const instance = new Test();
      const form = document.createElement("form");
      const fieldset = document.createElement("fieldset");
      new Document().append(form);
      form.append(fieldset);
      fieldset.append(instance);
      expect(decoratedSpy.callCount).to.equal(0);
      fieldset.disabled = true;
      expect(decoratedSpy.callCount).to.equal(1);
      expect(decoratedSpy.getCalls()[0].args).to.eql([instance, true]);
      fieldset.disabled = false;
      expect(decoratedSpy.callCount).to.equal(2);
      expect(decoratedSpy.getCalls()[1].args).to.eql([instance, false]);
    });
  });

  // Don't know how to properly test this one ¯\_(ツ)_/¯
  describe.skip("@formStateRestore", () => undefined);

  describe("@init", () => {
    test("run method on init", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        @init() test() {
          fn(this.x);
        }
      }
      const el = new Test();
      el.x = "B";
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql(["A"]);
    });

    test("run field function on init", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        @init() test = () => fn(this.x);
      }
      const el = new Test();
      el.x = "B";
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql(["A"]);
    });

    test("fail on non-functions type fields", async () => {
      expect(() => {
        @define(generateTagName())
        class Test extends HTMLElement {
          @init() test: any = 42;
        }
        new Test();
      }).to.throw();
    });

    test("Attribute values are available when decorated methods run", async () => {
      const fn = spy();
      const tagName = generateTagName();
      @define(tagName)
      class Test extends HTMLElement {
        @attr(string()) accessor attr = "";
        @init() test() {
          fn(this.attr);
        }
      }
      const fixture = document.createElement("div");
      document.body.append(fixture);
      fixture.innerHTML = `<${tagName} attr="aaa"></${tagName}>`;
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql(["aaa"]);
    });
  });

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
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(number()) accessor value = 0;
        @reactive({
          predicate: (instance) => instance.value % 2 === 0,
        })
        test() {
          fn(this.value);
        }
      }
      const el = new Test();
      el.value++;
      expect(fn.callCount).to.equal(0);
      el.value++;
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql([2]);
      el.value++;
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql([2]);
      el.value++;
      expect(fn.callCount).to.equal(2);
      expect(fn.getCalls()[0].args).to.eql([2]);
      expect(fn.getCalls()[1].args).to.eql([4]);
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

  describe("@subscribe", () => {
    describe("@subscribe on signals", () => {
      test("subscribe a method to a signal", async () => {
        const fn = spy();
        const counter = signal(0);
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(counter)
          test() {
            fn(this, counter.value);
          }
        }
        const instance = new Test();
        counter.value = 1;
        counter.value = 2;
        counter.value = 3;
        expect(fn.callCount).to.equal(4);
        expect(fn.getCalls()[0].args).to.eql([instance, 0]);
        expect(fn.getCalls()[1].args).to.eql([instance, 1]);
        expect(fn.getCalls()[2].args).to.eql([instance, 2]);
        expect(fn.getCalls()[3].args).to.eql([instance, 3]);
      });

      test("subscribe a method to a signal with a predicate", async () => {
        const fn = spy();
        const counter = signal(0);
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(counter, { predicate: (_, v) => v % 2 === 0 })
          test() {
            fn(this, counter.value);
          }
        }
        const instance = new Test();
        counter.value = 1;
        counter.value = 2;
        counter.value = 3;
        expect(fn.callCount).to.equal(2);
        expect(fn.getCalls()[0].args).to.eql([instance, 0]);
        expect(fn.getCalls()[1].args).to.eql([instance, 2]);
      });

      test("subscribe a field function to a signal", async () => {
        const fn = spy();
        const counter = signal(0);
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(counter) test = () => fn(this, counter.value);
        }
        const instance = new Test();
        counter.value = 1;
        counter.value = 2;
        counter.value = 3;
        expect(fn.callCount).to.equal(4);
        expect(fn.getCalls()[0].args).to.eql([instance, 0]);
        expect(fn.getCalls()[1].args).to.eql([instance, 1]);
        expect(fn.getCalls()[2].args).to.eql([instance, 2]);
        expect(fn.getCalls()[3].args).to.eql([instance, 3]);
      });

      test("custom subscribe and unsubscribe triggers", async () => {
        const fn = spy();
        const counter = signal(0);
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(counter, {
            activateOn: ["connected"],
            deactivateOn: ["disconnected"],
          })
          test() {
            fn(this, counter.value);
          }
        }
        // Init: no effect, subscription ony activates on connect
        const instance = new Test();
        expect(fn.callCount).to.equal(0);
        // First update: no effect, subscription ony activates on connect
        counter.value = 1;
        expect(fn.callCount).to.equal(0);
        // Connect: activates subscription
        document.body.append(instance);
        expect(fn.callCount).to.equal(1);
        expect(fn.getCalls()[0].args).to.eql([instance, 1]);
        counter.value = 2;
        expect(fn.callCount).to.equal(2);
        expect(fn.getCalls()[1].args).to.eql([instance, 2]);
        // Synthetic second connect event should not have any effect
        trigger(instance, "connected");
        expect(fn.callCount).to.equal(2);
        // Two connect events should still only result in one subscription
        counter.value = 3;
        expect(fn.callCount).to.equal(3);
        expect(fn.getCalls()[2].args).to.eql([instance, 3]);
        // Disconnecting unsubscribes
        instance.remove();
        counter.value = 4;
        expect(fn.callCount).to.equal(3);
        // Synthetic second disconnect event should not have any effect
        trigger(instance, "disconnected");
      });
    });

    describe("@subscribe on event targets", () => {
      test("subscribe a method to an event target", async () => {
        const fn = spy();
        const target = new EventTarget();
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(target, "foo")
          test(event: Event) {
            fn(this, event, event.target);
          }
        }
        const instance = new Test();
        const event = new Event("foo");
        target.dispatchEvent(event);
        expect(fn.callCount).to.equal(1);
        expect(fn.getCalls()[0].args).to.eql([instance, event, target]);
      });

      test("subscribe a field function to an event target", async () => {
        const fn = spy();
        const target = new EventTarget();
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(target, "foo") test = (event: Event) =>
            fn(this, event, event.target);
        }
        const instance = new Test();
        const event = new Event("foo");
        target.dispatchEvent(event);
        expect(fn.callCount).to.equal(1);
        expect(fn.getCalls()[0].args).to.eql([instance, event, target]);
      });

      test("subscribe a method to multiple events on an event target", async () => {
        const fn = spy();
        const target = new EventTarget();
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(target, "foo bar\n  baz")
          test(event: Event) {
            fn(this, event, event.target);
          }
        }
        const instance = new Test();
        const event1 = new Event("foo");
        const event2 = new Event("bar");
        const event3 = new Event("baz");
        target.dispatchEvent(event1);
        target.dispatchEvent(event2);
        target.dispatchEvent(event3);
        expect(fn.callCount).to.equal(3);
        expect(fn.getCalls()[0].args).to.eql([instance, event1, target]);
        expect(fn.getCalls()[1].args).to.eql([instance, event2, target]);
        expect(fn.getCalls()[2].args).to.eql([instance, event3, target]);
      });

      test("subscribe a method to an event target and access private fields", async () => {
        const fn = spy();
        const target = new EventTarget();
        @define(generateTagName())
        class Test extends HTMLElement {
          #foo = 42;
          @subscribe(target, "foo")
          test(event: Event) {
            fn(this, event, event.target, this.#foo);
          }
        }
        const instance = new Test();
        const event = new Event("foo");
        target.dispatchEvent(event);
        expect(fn.callCount).to.equal(1);
        expect(fn.getCalls()[0].args).to.eql([instance, event, target, 42]);
      });

      test("custom subscribe and unsubscribe triggers", async () => {
        const fn = spy();
        const target = new EventTarget();
        const triggerEvent = () => {
          const event = new Event("foo");
          target.dispatchEvent(event);
          return event;
        };
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(target, "foo", {
            activateOn: ["connected"],
            deactivateOn: ["disconnected"],
          })
          test(evt: any) {
            fn(this, evt);
          }
        }
        // Init: no effect, subscription ony activates on connect
        const instance = new Test();
        // First event: no effect, subscription ony activates on connect
        triggerEvent();
        expect(fn.callCount).to.equal(0);
        // Connect: activates subscription
        document.body.append(instance);
        const a = triggerEvent();
        expect(fn.callCount).to.equal(1);
        expect(fn.getCalls()[0].args).to.eql([instance, a]);
        // Synthetic second connect event should not have any effect. Two
        // connect events should still only result in one subscription
        trigger(instance, "connected");
        const b = triggerEvent();
        expect(fn.callCount).to.equal(2);
        expect(fn.getCalls()[1].args).to.eql([instance, b]);
        // Disconnecting unsubscribes
        instance.remove();
        triggerEvent();
        expect(fn.callCount).to.equal(2); // <- no change
        // Synthetic second disconnect event should not have any effect
        trigger(instance, "disconnected");
      });

      test("subscribe a method to an event target factory", async () => {
        const fn = spy();
        const target = new EventTarget();
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe((element) => {
            // can't check if this is actually "instance", because that's not
            // initialized at this point. But come on, what else could it be...
            expect(element).to.be.instanceOf(Test);
            return target;
          }, "foo")
          test(event: Event) {
            fn(this, event, event.target);
          }
        }
        const instance = new Test();
        const event = new Event("foo");
        target.dispatchEvent(event);
        expect(fn.callCount).to.equal(1);
        expect(fn.getCalls()[0].args).to.eql([instance, event, target]);
      });

      const FACTORY_FACTORIES = {
        function: (x: EventTarget) => () => x,
        promise: (x: EventTarget) => Promise.resolve(x),
        "promise-returning function": (x: EventTarget) => () =>
          Promise.resolve(x),
        "promise returning a function": (x: EventTarget) =>
          Promise.resolve(() => x),
        "promise returning a function returning a promise": (x: EventTarget) =>
          Promise.resolve(() => Promise.resolve(x)),
      };

      for (const [name, factoryFactory] of Object.entries(FACTORY_FACTORIES)) {
        test(`subscribe a method to an event target delivered by a factory: ${name}`, async () => {
          const fn = spy();
          const target = new EventTarget();
          @define(generateTagName())
          class Test extends HTMLElement {
            @subscribe(factoryFactory(target), "foo")
            test(event: Event) {
              fn(this, event, event.target);
            }
          }
          const instance = new Test();
          await wait(0);
          const event = new Event("foo");
          target.dispatchEvent(event);
          expect(fn.callCount).to.equal(1);
          expect(fn.getCalls()[0].args).to.eql([instance, event, target]);
        });
      }

      test("subscribe a method to an element", async () => {
        const fn = spy();
        const target = document.createElement("div");
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(target, "click")
          test(event: MouseEvent) {
            fn(this, event, event.target);
          }
        }
        const instance = new Test();
        const event = new MouseEvent("click");
        target.dispatchEvent(event);
        expect(fn.callCount).to.equal(1);
        expect(fn.getCalls()[0].args).to.eql([instance, event, target]);
      });

      test("subscribe a method in capture mode", async () => {
        const fn = spy();
        const parent = document.createElement("div");
        const target = document.createElement("div");
        parent.append(target);
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(parent, "test", { capture: true })
          test(event: Event) {
            fn(this, event, event.target);
          }
        }
        const instance = new Test();
        const event = new Event("test", { bubbles: false });
        target.dispatchEvent(event);
        expect(fn.callCount).to.equal(1);
        expect(fn.getCalls()[0].args).to.eql([instance, event, target]);
      });

      test("subscribe a method to events on the shadow dom", async () => {
        const fn = spy();
        const target = document.createElement("div");
        @define(generateTagName())
        class Test extends HTMLElement {
          root = this.attachShadow({ mode: "open" });
          constructor() {
            super();
            this.root.append(target);
          }
          @subscribe((instance: Test) => instance.root, "click")
          test(event: MouseEvent) {
            fn(this, event, event.target);
          }
        }
        const instance = new Test();
        const event = new MouseEvent("click", { bubbles: true });
        target.dispatchEvent(event);
        expect(fn.callCount).to.equal(1);
        expect(fn.getCalls()[0].args).to.eql([instance, event, target]);
      });

      test("subscribe a method to events on shadow dom from the constructor", async () => {
        const fn = spy();
        const target = document.createElement("div");
        @define(generateTagName())
        class Test extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: "open" }).append(target);
          }
          @subscribe((instance: Test) => instance.shadowRoot as any, "click")
          test(event: MouseEvent) {
            fn(this, event, event.target);
          }
        }
        const instance = new Test();
        const event = new MouseEvent("click", { bubbles: true });
        target.dispatchEvent(event);
        expect(fn.callCount).to.equal(1);
        expect(fn.getCalls()[0].args).to.eql([instance, event, target]);
      });

      test("subscribe a method with a predicate", async () => {
        const fn = spy();
        const target = new EventTarget();
        class TestEvent extends Event {
          value: boolean;
          constructor(value: boolean) {
            super("test");
            this.value = value;
          }
        }
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(target, "test", {
            predicate: (_, evt: TestEvent) => evt.value,
          })
          test(event: TestEvent) {
            fn(this, event.value);
          }
        }
        const instance = new Test();
        target.dispatchEvent(new TestEvent(true));
        target.dispatchEvent(new TestEvent(false));
        target.dispatchEvent(new TestEvent(true));
        target.dispatchEvent(new TestEvent(false));
        expect(fn.callCount).to.equal(2);
        expect(fn.getCalls()[0].args).to.eql([instance, true]);
        expect(fn.getCalls()[1].args).to.eql([instance, true]);
      });

      test("subscribe a field function with a predicate", async () => {
        const fn = spy();
        const target = new EventTarget();
        class TestEvent extends Event {
          value: boolean;
          constructor(value: boolean) {
            super("test");
            this.value = value;
          }
        }
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(target, "test", {
            predicate: (_, evt: TestEvent) => evt.value,
          })
          test = (event: TestEvent) => fn(this, event.value);
        }
        const instance = new Test();
        target.dispatchEvent(new TestEvent(true));
        target.dispatchEvent(new TestEvent(false));
        target.dispatchEvent(new TestEvent(true));
        target.dispatchEvent(new TestEvent(false));
        expect(fn.callCount).to.equal(2);
        expect(fn.getCalls()[0].args).to.eql([instance, true]);
        expect(fn.getCalls()[1].args).to.eql([instance, true]);
      });

      test("require the correct event types", async () => {
        const t1 = document.createElement("div");
        class Test extends HTMLElement {
          @subscribe<Test, HTMLElement, "foo", HTMLElementEventMap>(t1, "foo")
          test1(evt: Event) {}
          @subscribe<Test, HTMLElement, "click", HTMLElementEventMap>(
            t1,
            "click",
          )
          test2(evt: MouseEvent) {}
          @subscribe<Test, HTMLElement, "focus", HTMLElementEventMap>(
            t1,
            "focus",
          )
          test3(evt: FocusEvent) {}
          @subscribe<Test, HTMLElement, "focus click", HTMLElementEventMap>(
            t1,
            "focus click",
          )
          test4(evt: MouseEvent | FocusEvent) {}
          @subscribe<Test, HTMLElement, "focus click", HTMLElementEventMap>(
            t1,
            // @ts-expect-error wrong event type
            "foo",
          )
          test5(evt: MouseEvent) {}
          @subscribe<Test, HTMLElement, "focus click", HTMLElementEventMap>(
            t1,
            // @ts-expect-error wrong event type
            "focus",
          )
          test6(evt: MouseEvent) {}
          // @ts-expect-error wrong event type
          @subscribe<Test, HTMLElement, "focus click", HTMLElementEventMap>(
            t1,
            "focus click",
          )
          test7(evt: DragEvent) {}
          // Accept anything in the absence of generics
          @subscribe(t1, "whatever") test8(evt: DragEvent) {} // Yolo
        }
      });

      test("reject on static fields", async () => {
        expect(() => {
          class Test extends HTMLElement {
            // @ts-expect-error for testing runtime checks
            @subscribe(new EventTarget(), "foo") static test() {
              return;
            }
          }
        }).to.throw(TypeError);
      });
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

  describe("Regressions", () => {
    test("co-existence of @debounce() and @reactive() on private fields does not blow up", async () => {
      // This problem only manifests itself when @debounce is applied to a
      // private field and a private method is decorated with @reactive
      @define(generateTagName())
      class Test extends HTMLElement {
        // Using timeout because RAF is unreliable in headless browsers
        @debounce({ fn: debounce.timeout(0) }) #a = () => {};
        @reactive() #test() {}
      }
      new Test();
    });
  });
});
