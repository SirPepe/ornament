import { expect } from "@esm-bundle/chai";
import { spy } from "sinon";
import {
  attr,
  connected,
  debounce,
  define,
  disconnected,
  prop,
  reactive,
  subscribe,
} from "../src/decorators.js";
import { href, json, number, string } from "../src/transformers.js";
import { generateTagName, wait } from "./helpers.js";
import { signal } from "@preact/signals-core";
const test = it;

describe("Decorators", () => {
  describe("@define", () => {
    test("register element and create string tag", () => {
      @define("register-test")
      class Test extends HTMLElement {}
      expect(window.customElements.get("register-test")).to.equal(Test);
      expect(document.createElement("register-test")).to.be.instanceOf(Test);
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

    test("reject on non-public fields", async () => {
      expect(() => {
        class Test extends HTMLElement {
          @attr(string()) accessor #x = "A";
        }
      }).to.throw(TypeError);
      expect(() => {
        const key = Symbol();
        class Test extends HTMLElement {
          @attr(string()) accessor [key] = "A";
        }
      }).to.throw(TypeError);
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
        @debounce({ fn: debounce.timeout(0) }) test = (x: number) => {
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
        @debounce({ fn: debounce.timeout(0) }) #test = (x: number) => {
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

    test("predicate option", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(number()) accessor value = 0;
        @reactive({
          initial: false,
          predicate() {
            return this.value % 2 === 0;
          },
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
          predicate() {
            const result = this.value;
            this.value = true;
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
          @subscribe(counter, { predicate: (v) => v % 2 === 0 })
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
          @subscribe(function (this: Test) {
            return this.root;
          }, "click")
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
          @subscribe(function (this: Test) {
            return this.shadowRoot as any;
          }, "click")
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
          @subscribe(target, "test", { predicate: (evt) => evt.value })
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
    test.skip("co-existence on private fields does not blow up", async () => {
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
