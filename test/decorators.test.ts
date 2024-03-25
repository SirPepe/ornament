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

    test("upgrade only a subclass", () => {
      const fnBase = spy();
      const fnTest = spy();
      class Base extends HTMLElement {
        @prop(number()) accessor foo = 23;
        @reactive({ initial: false }) methodBase() {
          fnBase();
        }
      }
      @enhance()
      class Test extends Base {
        @prop(string()) accessor bar = "A";
        @reactive({ initial: false }) methodTest() {
          fnTest();
        }
      }
      window.customElements.define(generateTagName(), Test);
      const instance = new Test();
      instance.foo = 42;
      expect(fnBase.callCount).to.equal(1);
      expect(fnTest.callCount).to.equal(1);
      instance.bar = "B";
      expect(fnBase.callCount).to.equal(2);
      expect(fnTest.callCount).to.equal(2);
    });

    test("property access on the base class of an upgraded subclass", () => {
      const fn = spy();
      class Base extends HTMLElement {
        @reactive()
        method() {
          fn((this as any).foo);
        }
      }
      @enhance()
      class Test extends Base {
        @prop(string()) accessor foo = "A";
      }
      window.customElements.define(generateTagName(), Test);
      const instance = new Test();
      expect(fn.callCount).to.equal(1); // Initial call
      expect(fn.getCalls()[0].args).to.eql(["A"]); // Initial call
      instance.foo = "B";
      expect(fn.callCount).to.equal(2);
      expect(fn.getCalls()[1].args).to.eql(["B"]);
    });

    test("content attribute access on the base class of an upgraded subclass", () => {
      const fn = spy();
      class Base extends HTMLElement {
        @reactive()
        method() {
          fn((this as any).foo);
        }
      }
      @enhance()
      class Test extends Base {
        @attr(string()) accessor foo = "A";
      }
      const tagName = generateTagName();
      window.customElements.define(tagName, Test);
      const fixture = document.createElement("div");
      document.body.append(fixture);
      fixture.innerHTML = `<${tagName} foo="bar"></${tagName}>`;
      const instance = fixture.children[0] as Test;
      expect(fn.callCount).to.equal(1); // Initial call
      expect(fn.getCalls()[0].args).to.eql(["bar"]); // Initial call
      instance.foo = "baz";
      expect(fn.callCount).to.equal(2);
      expect(fn.getCalls()[1].args).to.eql(["baz"]);
      instance.setAttribute("foo", "foo");
      expect(fn.callCount).to.equal(3);
      expect(fn.getCalls()[2].args).to.eql(["foo"]);
    });

    test("upgrade only a base class", () => {
      const fnBase = spy();
      const fnTest = spy();
      @enhance()
      class Base extends HTMLElement {
        @prop(number()) accessor foo = 23;
        @reactive({ initial: false }) methodBase() {
          fnBase();
        }
      }
      class Test extends Base {
        @prop(string()) accessor bar = "A";
        @reactive({ initial: false }) methodTest() {
          fnTest();
        }
      }
      window.customElements.define(generateTagName(), Test);
      const instance = new Test();
      instance.foo = 42;
      expect(fnBase.callCount).to.equal(1);
      expect(fnTest.callCount).to.equal(1);
      instance.bar = "B";
      expect(fnBase.callCount).to.equal(2);
      expect(fnTest.callCount).to.equal(2);
    });

    test("upgrading the class twice has no adverse effect", () => {
      const fn = spy();
      @enhance()
      @enhance()
      class Test extends HTMLElement {
        @prop(number()) accessor test = 23;
        @reactive({ initial: false }) method() {
          fn(); // called *once* if enhance only applies its effect once
        }
      }
      window.customElements.define(generateTagName(), Test);
      const instance = new Test();
      instance.test = 42;
      expect(fn.callCount).to.equal(1);
    });

    test("upgrading a base class and a derived class has no adverse effect", () => {
      const fnBase = spy();
      const fnTest = spy();
      @enhance()
      class Base extends HTMLElement {
        @prop(number()) accessor foo = 23;
        @reactive({ initial: false }) methodBase() {
          fnBase(); // called *once* if enhance only applies its effect once
        }
      }
      @enhance()
      class Test extends Base {
        @prop(string()) accessor bar = "A";
        @reactive({ initial: false }) methodTest() {
          fnTest(); // called *once* if enhance only applies its effect once
        }
      }
      window.customElements.define(generateTagName(), Test);
      const instance = new Test();
      instance.foo = 42;
      expect(fnBase.callCount).to.equal(1);
      expect(fnTest.callCount).to.equal(1);
      instance.bar = "B";
      expect(fnTest.callCount).to.equal(2);
      expect(fnTest.callCount).to.equal(2);
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

    test("register base class and subclass as elements", () => {
      const nameBase = generateTagName();
      const nameTest = generateTagName();
      @define(nameBase)
      class Base extends HTMLElement {
        baseFn = spy();
        @prop(number()) accessor foo = 23;
        @reactive({ initial: false }) methodBase() {
          this.baseFn();
        }
      }
      @define(nameTest)
      class Test extends Base {
        testFn = spy();
        @prop(string()) accessor bar = "A";
        @reactive({ initial: false }) methodTest() {
          this.testFn();
        }
      }
      const baseInstance = new Base();
      baseInstance.foo = 42;
      expect(baseInstance.baseFn.callCount).to.equal(1);
      const testInstance = new Test();
      testInstance.foo = 42;
      expect(testInstance.testFn.callCount).to.equal(1);
      expect(testInstance.baseFn.callCount).to.equal(1);
      testInstance.bar = "B";
      expect(testInstance.testFn.callCount).to.equal(2);
      expect(testInstance.baseFn.callCount).to.equal(2);
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

    // This test (ONLY the _test_) currently fails in Firefox when transpiled by
    // Babel: https://github.com/babel/babel/issues/16379 (March 2024)
    // test("reject on static", () => {
    //   expect(() => {
    //     @define(generateTagName())
    //     class Test extends HTMLElement {
    //       // @ts-expect-error for testing runtime checks
    //       @prop(string()) static accessor foo = "A";
    //     }
    //   }).to.throw(TypeError);
    // });
    // TODO: re-enable this test
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
        @reactive({ initial: false }) test() {
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

    test("initialize attribute value early", async () => {
      const fn = spy();
      const tagName = generateTagName();
      @define(tagName)
      class Test extends HTMLElement {
        @attr(string()) accessor x = "A"; // this never appears
        @reactive()
        test() {
          fn(this.x);
        }
      }
      const container = document.createElement("div");
      container.innerHTML = `<${tagName} x="B"></${tagName}>`;
      expect(fn.getCalls().map(({ args }) => args)).to.eql([["B"]]);
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

    // This test (ONLY the _test_) currently fails in Firefox when transpiled by
    // Babel: https://github.com/babel/babel/issues/16379 (March 2024)
    // test("reject on static fields", async () => {
    //   expect(() => {
    //     class Test extends HTMLElement {
    //       // @ts-expect-error for testing runtime checks
    //       @attr(string()) static accessor x = "A";
    //     }
    //   }).to.throw(TypeError);
    // });
    // TODO: re-enable this test
  });

  describe("@debounce", () => {
    test("debouncing class field functions", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        // Using timeout because RAF is unreliable in headless browsers
        @debounce<Test, [number]>({ fn: debounce.timeout(0) }) test = (
          x: number,
        ) => {
          fn(x, this);
          return x;
        };
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
        @debounce<Test, [number]>({ fn: debounce.timeout(0) }) #test = (
          x: number,
        ) => {
          fn(x, this);
          return x;
        };
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

    test("access to private fields", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        #foo = 42;
        // Using timeout because RAF is unreliable in headless browsers
        @debounce({ fn: debounce.timeout(0) }) test(x: number): number {
          fn(x, this.#foo, this);
          return x;
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
  });

  describe("@connected/@disconnected", () => {
    test("fire on (dis)connect", async () => {
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
  });

  describe("@adopted", () => {
    test("fire on adoption", async () => {
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
    test("fire on form association", async () => {
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
  });

  describe("@formReset", () => {
    test("fire on form reset", async () => {
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
  });

  describe("@formDisabled", () => {
    test("fire on fieldset disable", async () => {
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
  });

  describe.skip("@formStateRestore", () => undefined);

  describe("@reactive", () => {
    test("initial call with reactive property", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        @reactive() test() {
          fn(this.x);
        }
      }
      new Test();
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql(["A"]);
    });

    test("prop change", async () => {
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
      expect(fn.callCount).to.equal(2); // initial + one update
      expect(fn.getCalls()[0].args).to.eql(["A"]);
      expect(fn.getCalls()[1].args).to.eql(["B"]);
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
      expect(fn.callCount).to.equal(2); // initial + one update
      expect(fn.getCalls()[0].args).to.eql(["B"]);
      expect(fn.getCalls()[1].args).to.eql(["C"]);
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
      expect(fn.callCount).to.equal(3); // initial + two updates
      expect(fn.getCalls()[0].args).to.eql(["A", "Z"]);
      expect(fn.getCalls()[1].args).to.eql(["B", "Z"]);
      expect(fn.getCalls()[2].args).to.eql(["B", "Y"]);
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
      expect(fn.callCount).to.equal(2); // initial + one update
      expect(fn.getCalls()[0].args).to.eql(["A"]);
      expect(fn.getCalls()[1].args).to.eql(["B"]);
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
      expect(fn.callCount).to.equal(2); // initial + one update
      expect(fn.getCalls()[0].args).to.eql(["A"]);
      expect(fn.getCalls()[1].args).to.eql(["B"]);
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
      expect(fn.callCount).to.equal(2); // initial + one update
      expect(fn.getCalls()[0].args).to.eql([[1]]);
      expect(fn.getCalls()[1].args).to.eql([[2]]);
    });

    test("attr change causes only one effect to run, not also the attributeChangedCallback (two primitive updates)", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string()) accessor foo = "a";
        @attr(string()) accessor bar = "x";
        @reactive({ initial: false }) test() {
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
          initial: false,
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
          initial: false,
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
        @reactive({ keys: ["x"], initial: false }) testX() {
          fnX(this.x, this.y);
        }
        @reactive({ keys: ["y"], initial: false }) testY() {
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
        @reactive({ keys: ["#x"], initial: false }) testX() {
          fnX(this.#x, this.y);
        }
        @reactive({ keys: ["y"], initial: false }) testY() {
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
      expect(fn.callCount).to.equal(2); // initial + one update
      expect(fn.getCalls()[0].args).to.eql(["A"]);
      expect(fn.getCalls()[1].args).to.eql(["B"]);
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
      expect(fn.callCount).to.equal(2); // initial + one update
      expect(fn.getCalls()[0].args).to.eql(["A"]);
      expect(fn.getCalls()[1].args).to.eql(["B"]);
    });

    test("skip initial call with options.initial = false", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        @reactive({ initial: false }) test() {
          fn(this.x);
        }
      }
      const el = new Test();
      el.x = "B";
      expect(fn.callCount).to.equal(1); // one update
      expect(fn.getCalls()[0].args).to.eql(["B"]);
    });

    test("skip initial call when options.predicate returns false", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        value = false;
        @prop(string()) accessor x = "A";
        @reactive({
          predicate(instance) {
            const result = instance.value;
            instance.value = true;
            return result;
          },
        })
        test() {
          fn(this.x);
        }
      }
      const el = new Test();
      el.x = "B";
      expect(fn.callCount).to.equal(1); // one update
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
      expect(fn.callCount).to.equal(2); // initial + one update
      expect(fn.getCalls()[0].args).to.eql(["A", 42]);
      expect(fn.getCalls()[1].args).to.eql(["B", 42]);
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
      expect(fn.callCount).to.equal(2); // initial + 1 update
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
      test("subscribe to a signal", async () => {
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

      test("subscribe to a signal with a predicate", async () => {
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
    });

    describe("@subscribe on event targets", () => {
      test("subscribe to an event target", async () => {
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

      test("subscribe to multiple events on an event target", async () => {
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

      test("subscribe to an event target and access private fields", async () => {
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

      test("subscribe to an event target factory", async () => {
        const fn = spy();
        const target = new EventTarget();
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(() => target, "foo")
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

      test("subscribe to an element", async () => {
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

      test("subscribe in capture mode", async () => {
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

      test("subscribe to events on the shadow dom", async () => {
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

      test("subscribe to events on shadow dom from the constructor", async () => {
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

      test("subscribe with a predicate", async () => {
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
          @subscribe(target, "test", { predicate: (_, evt) => evt.value })
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

  describe("@reactive + @debounce", () => {
    test("debounced @reactive method", async () => {
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
        @debounce<Test, []>({ fn: debounce.timeout(0) }) #a = () => {};
        @reactive() #test() {}
      }
      new Test();
    });
  });
});
