/**
 * @jest-environment jsdom
 */

import { attr, define, prop, reactive } from "../src/decorators";
import { string } from "../src/transformers";
import { generateTagName, tick } from "./helpers";

describe("Decorators", () => {
  describe("@define", () => {
    test("register element", () => {
      const tagName = generateTagName();
      @define(tagName)
      class Test extends HTMLElement {}
      expect(window.customElements.get(tagName)).toBe(Test);
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
      await tick(); // Attribute reactions are async
      expect(el.x).toBe("C");
      expect(el.getAttribute("x")).toBe("C");
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
      await tick(); // Attribute reactions are async
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
      await tick(); // Attribute reactions are async
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

  describe("@reactive", () => {
    test("prop changes trigger @reactive", async () => {
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
      el.x = "C";
      el.x = "D";
      await tick(); // Reactions are batched and therefore async
      expect(spy).toBeCalledTimes(2); // initial + one update
      expect(spy.mock.calls).toEqual([["A"], ["D"]]);
    });

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
      await tick(); // Reactions are batched and therefore async
      expect(spy).toBeCalledTimes(1);
      expect(spy.mock.calls).toEqual([["A"]]);
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
      el.x = "W";
      el.y = "Y";
      el.x = "B";
      await tick(); // Reactions are batched and therefore async
      expect(spy).toBeCalledTimes(2); // initial + one update
      expect(spy.mock.calls).toEqual([
        ["A", "Z"],
        ["B", "Y"],
      ]);
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
      el.x = "C";
      el.x = "D";
      await tick(); // Reactions are batched and therefore async
      expect(spy).toBeCalledTimes(2); // initial + one update
      expect(spy.mock.calls).toEqual([["A"], ["D"]]);
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
      el.setAttribute("x", "C");
      el.setAttribute("x", "D");
      await tick(); // Reactions are batched and therefore async
      expect(spy).toBeCalledTimes(2); // initial + one update
      expect(spy.mock.calls).toEqual([["A"], ["D"]]);
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
      el.x = "C";
      el.x = "D";
      await tick(); // Reactions are batched and therefore async
      expect(spy).toBeCalledTimes(1); // one update
      expect(spy.mock.calls).toEqual([["D"]]);
    });
  });
});
