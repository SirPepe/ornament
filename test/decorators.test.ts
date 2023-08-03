/**
 * @jest-environment jsdom
 */

import { attr, debounce, define, prop, reactive } from "../src/decorators";
import { href, string } from "../src/transformers";
import { generateTagName, wait } from "./helpers";

describe("Decorators", () => {
  describe("@define", () => {
    test("register element with automatically derived tag name", () => {
      @define()
      class MyTest extends HTMLElement {}
      expect(window.customElements.get("my-test")).toBe(MyTest);
      expect(document.createElement("my-test").toString()).toEqual(
        "[object HTMLMyTestElement]"
      );
    });

    test("respect built-in toStringTags", () => {
      const tagName = generateTagName();
      @define(tagName)
      class Test extends HTMLElement {
        get [Symbol.toStringTag]() {
          return "A";
        }
      }
      expect(document.createElement(tagName).toString()).toEqual("[object A]");
    });

    test("reject an invalid automatically derived tag name", () => {
      expect(() => {
        @define()
        class asdf extends HTMLElement {}
      }).toThrow();
    });

    test("register element with a manually provided tag name", () => {
      const tagName = generateTagName();
      @define(tagName)
      class Test extends HTMLElement {}
      expect(window.customElements.get(tagName)).toBe(Test);
    });

    test("reject an invalid manually provided tag name", () => {
      expect(() => {
        @define("invalid")
        class Test extends HTMLElement {}
      }).toThrow();
    });
  });

  describe("@prop", () => {
    test("register property", () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
      }
      const el = new Test();
      expect(el.x).toBe("A");
      expect(el.getAttribute("x")).toBe(null);
      el.x = "B";
      expect(el.x).toBe("B");
      expect(el.getAttribute("x")).toBe(null);
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
      expect(el.testGet()).toBe("B");
    });

    test("register symbol property", () => {
      const key = Symbol();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor [key] = "A";
      }
      const el = new Test();
      el[key] = "B";
      expect(el[key]).toBe("B");
    });
  });

  describe("@attr", () => {
    test("register attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string()) accessor x = "A";
      }
      const el = new Test();
      expect(el.x).toBe("A");
      expect(el.getAttribute("x")).toBe(null);
      el.x = "B";
      expect(el.x).toBe("B");
      expect(el.getAttribute("x")).toBe("B");
      el.setAttribute("x", "C");
      expect(el.x).toBe("C");
      expect(el.getAttribute("x")).toBe("C");
    });

    test("user-defined attribute handling keeps working", async () => {
      const userDefinedCallback = jest.fn();
      const reactiveCallback = jest.fn();
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
      expect(userDefinedCallback).toBeCalledTimes(1);
      expect(userDefinedCallback.mock.calls).toEqual([[el, "y"]]);
      expect(reactiveCallback).toBeCalledTimes(1);
      expect(reactiveCallback.mock.calls).toEqual([[el]]);
    });

    test("no cross-instance effects", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(href()) accessor x = "";
      }
      const el1 = new Test();
      const el2 = new Test();
      expect(el1.x).toBe("");
      expect(el2.x).toBe("");
      el1.x = window.location.href;
      expect(el1.x).toBe(window.location.href);
      expect(el2.x).toBe("");
    });

    test("initialize attribute value", async () => {
      const tagName = generateTagName();
      @define(tagName)
      class Test extends HTMLElement {
        @attr(string()) accessor x = "A";
      }
      const container = document.createElement("div");
      container.innerHTML = `<${tagName} x="B"></${tagName}>`;
      expect((container.children[0] as any).x).toBe("B");
    });

    test("Non-reflective attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string(), { reflective: false }) accessor x = "A";
      }
      const el = new Test();
      expect(el.x).toBe("A");
      expect(el.getAttribute("x")).toBe(null);
      el.x = "B";
      expect(el.x).toBe("B");
      expect(el.getAttribute("x")).toBe(null);
      el.setAttribute("x", "C");
      expect(el.x).toBe("B");
      expect(el.getAttribute("x")).toBe("C");
    });

    test("custom attribute name via 'as'", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string(), { as: "y" }) accessor x = "A";
      }
      const el = new Test();
      expect(el.x).toBe("A");
      expect(el.getAttribute("y")).toBe(null);
      el.x = "B";
      expect(el.x).toBe("B");
      expect(el.getAttribute("y")).toBe("B");
      el.setAttribute("y", "C");
      expect(el.x).toBe("C");
      expect(el.getAttribute("y")).toBe("C");
    });

    test("reject on non-public fields", async () => {
      expect(() => {
        class Test extends HTMLElement {
          @attr(string()) accessor #x = "A";
        }
      }).toThrow(TypeError);
      expect(() => {
        const key = Symbol();
        class Test extends HTMLElement {
          @attr(string()) accessor [key] = "A";
        }
      }).toThrow(TypeError);
    });
  });

  describe("@debounce", () => {
    test("debouncing class field functions", async () => {
      const spy = jest.fn();
      @define(generateTagName())
      class Test extends HTMLElement {
        @debounce() test = (x: number) => {
          spy(x, this);
          return x;
        };
      }
      const el = new Test();
      const func = el.test;
      el.test(1);
      el.test(2);
      func(3);
      await wait(100);
      expect(spy).toBeCalledTimes(1);
      expect(spy.mock.calls).toEqual([[3, el]]);
    });

    test("debouncing class methods", async () => {
      const spy = jest.fn();
      @define(generateTagName())
      class Test extends HTMLElement {
        @debounce() test(x: number): number {
          spy(x, this);
          return x;
        }
      }
      const el = new Test();
      el.test(1);
      el.test(2);
      el.test(3);
      await wait(100);
      expect(spy).toBeCalledTimes(1);
      expect(spy.mock.calls).toEqual([[3, el]]);
    });
  });

  describe("@reactive", () => {
    test("initial call with reactive property", async () => {
      const spy = jest.fn();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        @reactive() test() {
          spy(this.x);
        }
      }
      new Test();
      expect(spy).toBeCalledTimes(1);
      expect(spy.mock.calls).toEqual([["A"]]);
    });

    test("prop change", async () => {
      const spy = jest.fn();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        @reactive() test() {
          spy(this.x);
        }
      }
      const el = new Test();
      el.x = "B";
      expect(spy).toBeCalledTimes(2); // initial + one update
      expect(spy.mock.calls).toEqual([["A"], ["B"]]);
    });

    test("prop changes in the constructor cause no reaction", async () => {
      const spy = jest.fn();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        constructor() {
          super();
          this.x = "B";
        }
        @reactive() test() {
          spy(this.x);
        }
      }
      const el = new Test();
      el.x = "C";
      expect(spy).toBeCalledTimes(2); // initial + one update
      expect(spy.mock.calls).toEqual([["B"], ["C"]]);
    });

    test("two prop changes", async () => {
      const spy = jest.fn();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        @prop(string()) accessor y = "Z";
        @reactive() test() {
          spy(this.x, this.y);
        }
      }
      const el = new Test();
      el.x = "B";
      el.y = "Y";
      expect(spy).toBeCalledTimes(3); // initial + two updates
      expect(spy.mock.calls).toEqual([
        ["A", "Z"],
        ["B", "Z"],
        ["B", "Y"],
      ]);
    });

    test("multiple prop changes with the same value only cause one effect to run", async () => {
      const spy = jest.fn();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        @reactive() test() {
          spy(this.x);
        }
      }
      const el = new Test();
      el.x = "B";
      el.x = "B";
      el.x = "B";
      expect(spy).toBeCalledTimes(2); // initial + one update
      expect(spy.mock.calls).toEqual([["A"], ["B"]]);
    });

    test("select option", async () => {
      const spyX = jest.fn();
      const spyY = jest.fn();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        @prop(string()) accessor y = "Z";
        @reactive({ keys: ["x"], initial: false }) testX() {
          spyX(this.x, this.y);
        }
        @reactive({ keys: ["y"], initial: false }) testY() {
          spyY(this.x, this.y);
        }
      }
      const el = new Test();
      el.x = "B";
      expect(spyX).toBeCalledTimes(1);
      expect(spyX.mock.calls).toEqual([["B", "Z"]]);
      expect(spyY).toBeCalledTimes(0);
      el.y = "Y";
      expect(spyX).toBeCalledTimes(1);
      expect(spyX.mock.calls).toEqual([["B", "Z"]]);
      expect(spyY).toBeCalledTimes(1);
      expect(spyY.mock.calls).toEqual([["B", "Y"]]);
    });

    test("select option with private keys", async () => {
      const spyX = jest.fn();
      const spyY = jest.fn();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor #x = "A";
        @prop(string()) accessor y = "Z";
        setX(value: string): void {
          this.#x = value;
        }
        @reactive({ keys: ["#x"], initial: false }) testX() {
          spyX(this.#x, this.y);
        }
        @reactive({ keys: ["y"], initial: false }) testY() {
          spyY(this.#x, this.y);
        }
      }
      const el = new Test();
      el.setX("B");
      expect(spyX).toBeCalledTimes(1);
      expect(spyX.mock.calls).toEqual([["B", "Z"]]);
      expect(spyY).toBeCalledTimes(0);
      el.y = "Y";
      expect(spyX).toBeCalledTimes(1);
      expect(spyX.mock.calls).toEqual([["B", "Z"]]);
      expect(spyY).toBeCalledTimes(1);
      expect(spyY.mock.calls).toEqual([["B", "Y"]]);
    });

    test("attribute changes via setter trigger @reactive", async () => {
      const spy = jest.fn();
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string()) accessor x = "A";
        @reactive() test() {
          spy(this.x);
        }
      }
      const el = new Test();
      el.x = "B";
      expect(spy).toBeCalledTimes(2); // initial + one update
      expect(spy.mock.calls).toEqual([["A"], ["B"]]);
    });

    test("attributes changes via setAttribute trigger @reactive", async () => {
      const spy = jest.fn();
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string()) accessor x = "A";
        @reactive() test() {
          spy(this.x);
        }
      }
      const el = new Test();
      el.setAttribute("x", "B");
      expect(spy).toBeCalledTimes(2); // initial + one update
      expect(spy.mock.calls).toEqual([["A"], ["B"]]);
    });

    test("skip initial call with options.initial = false", async () => {
      const spy = jest.fn();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        @reactive({ initial: false }) test() {
          spy(this.x);
        }
      }
      const el = new Test();
      el.x = "B";
      expect(spy).toBeCalledTimes(1); // one update
      expect(spy.mock.calls).toEqual([["B"]]);
    });
  });

  describe("@reactive + @debounce", () => {
    test("debounced @reactive method", async () => {
      const spy = jest.fn();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        @reactive() @debounce() test() {
          spy(this.x);
        }
      }
      const el = new Test();
      el.x = "B";
      el.x = "C";
      el.x = "D";
      expect(spy).toBeCalledTimes(1); // initial
      expect(spy.mock.calls).toEqual([["A"]]);
      await wait(25);
      expect(spy).toBeCalledTimes(2); // initial + one update
      expect(spy.mock.calls).toEqual([["A"], ["D"]]);
    });
  });
});
