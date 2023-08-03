/**
 * @jest-environment jsdom
 */

import { attr, define } from "../src/decorators";
import {
  boolean,
  event,
  href,
  int,
  literal,
  number,
  record,
  string,
} from "../src/transformers";
import { generateTagName, wait } from "./helpers";

describe("Transformers", () => {
  describe("string()", () => {
    test("as attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string()) accessor foo = "";
      }
      const el = new Test();
      expect(el.foo).toBe("");
      expect(el.getAttribute("foo")).toBe(null);
      el.foo = "A";
      expect(el.foo).toBe("A");
      expect(el.getAttribute("foo")).toBe("A");
      el.setAttribute("foo", "B");
      expect(el.foo).toBe("B");
      expect(el.getAttribute("foo")).toBe("B");
      el.removeAttribute("foo");
      expect(el.foo).toBe("");
      expect(el.getAttribute("foo")).toBe(null);
      el.foo = "A";
      el.foo = "";
      expect(el.foo).toBe("");
      expect(el.getAttribute("foo")).toBe("");
      el.foo = null as any;
      expect(el.foo).toBe("null");
      expect(el.getAttribute("foo")).toBe("null");
      el.foo = false as any;
      expect(el.foo).toBe("false");
      expect(el.getAttribute("foo")).toBe("false");
    });

    test("custom fallback value", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string()) accessor foo = "default";
      }
      const el = new Test();
      el.foo = "Hello";
      expect(el.getAttribute("foo")).toBe("Hello");
      el.removeAttribute("foo");
      expect(el.foo).toBe("default");
    });

    test("non-initialized accessor", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string()) accessor foo: any;
      }
      const el = new Test();
      expect(el.foo).toBe("");
      el.foo = "Hello";
      expect(el.getAttribute("foo")).toBe("Hello");
      el.removeAttribute("foo");
      expect(el.foo).toBe("");
      el.foo = "Hello";
      expect(el.foo).toBe("Hello");
      el.foo = undefined as any;
      expect(el.foo).toBe("");
    });
  });

  describe("href()", () => {
    test("as attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(href()) accessor foo = "";
      }
      const el = new Test();
      expect(el.foo).toBe("");
      expect(el.getAttribute("foo")).toBe(null);
      el.foo = "";
      expect(el.foo).toBe("http://localhost/");
      expect(el.getAttribute("foo")).toBe("");
      el.setAttribute("foo", "asdf");
      expect(el.foo).toBe("http://localhost/asdf");
      expect(el.getAttribute("foo")).toBe("asdf");
      el.removeAttribute("foo");
      expect(el.foo).toBe("");
      el.foo = "https://example.com/asdf/";
      expect(el.foo).toBe("https://example.com/asdf/");
    });

    test("from HTML", async () => {
      const tagName = generateTagName();
      @define(tagName)
      class Test extends HTMLElement {
        @attr(href()) accessor foo = "";
      }
      const fixture = document.createElement("div");
      fixture.innerHTML = `<${tagName} foo="https://example.com/asdf"></${tagName}>`;
      expect((fixture.children[0] as any).foo).toBe("https://example.com/asdf");
    });
  });

  describe("number()", () => {
    test("invalid options", () => {
      // min/max contradictions
      expect(
        () =>
          class extends HTMLElement {
            @attr(number({ min: 1, max: 0 })) accessor foo = 1;
          }
      ).toThrow();
      expect(
        () =>
          class extends HTMLElement {
            @attr(number({ min: 1, max: 1 })) accessor foo = 1;
          }
      ).toThrow();
      // Invalid initial value
      expect(() => {
        @define(generateTagName())
        class Test extends HTMLElement {
          @attr(number({ min: 0, max: 10 })) accessor foo = -7;
        }
        new Test();
      }).toThrow();
    });

    test("as attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(number()) accessor foo = 0;
      }
      const el = new Test();
      expect(el.foo).toBe(0);
      expect(el.getAttribute("foo")).toBe(null);
      el.foo = 1;
      expect(el.foo).toBe(1);
      expect(el.getAttribute("foo")).toBe("1");
      el.setAttribute("foo", "2");
      expect(el.foo).toBe(2);
      el.setAttribute("foo", "2.22");
      expect(el.foo).toBe(2.22);
      el.removeAttribute("foo");
      expect(el.foo).toBe(0);
      expect(el.getAttribute("foo")).toBe(null);
      el.foo = 3;
      el.setAttribute("foo", "asdf");
      expect(el.foo).toBe(0);
    });

    test("min/max", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(number({ min: 0, max: 10 })) accessor foo = 0;
      }
      const el = new Test();
      expect(() => {
        el.foo = -1;
      }).toThrow();
      el.setAttribute("foo", "22");
      expect(el.foo).toBe(10);
    });

    test("custom fallback value", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(number()) accessor foo = 7;
      }
      const el = new Test();
      el.foo = 8;
      expect(el.getAttribute("foo")).toBe("8");
      el.removeAttribute("foo");
      expect(el.foo).toBe(7);
    });

    test("non-initialized accessor", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(number()) accessor foo: any;
      }
      const el = new Test();
      expect(el.foo).toBe(0);
      el.foo = 7;
      expect(el.getAttribute("foo")).toBe("7");
      el.removeAttribute("foo");
      expect(el.foo).toBe(0);
      el.foo = 7;
      expect(el.foo).toBe(7);
      el.foo = undefined as any;
      expect(el.foo).toBe(0);
    });
  });

  describe("int()", () => {
    test("as attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(int()) accessor foo = 0n;
      }
      const el = new Test();
      expect(el.foo).toBe(0n);
      expect(el.getAttribute("foo")).toBe(null);
      el.foo = 1n;
      expect(el.foo).toBe(1n);
      expect(el.getAttribute("foo")).toBe("1");
      el.setAttribute("foo", "2");
      expect(el.foo).toBe(2n);
      el.setAttribute("foo", "2.75");
      expect(el.foo).toBe(0n);
      el.setAttribute("foo", "3");
      expect(el.foo).toBe(3n);
      el.removeAttribute("foo");
      expect(el.foo).toBe(0n);
    });

    test("min/max", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(int({ min: 0n, max: 10n })) accessor foo = 0n;
      }
      const el = new Test();
      expect(() => {
        el.foo = -1n;
      }).toThrow();
      el.setAttribute("foo", "22");
      expect(el.foo).toBe(10n);
    });

    test("custom fallback value", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(int()) accessor foo = 7n;
      }
      const el = new Test();
      el.foo = 8n;
      expect(el.getAttribute("foo")).toBe("8");
      el.removeAttribute("foo");
      expect(el.foo).toBe(7n);
    });

    test("non-initialized accessor", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(int()) accessor foo: any;
      }
      const el = new Test();
      expect(el.foo).toBe(0n);
      el.foo = 7n;
      expect(el.getAttribute("foo")).toBe("7");
      el.removeAttribute("foo");
      expect(el.foo).toBe(0n);
      el.foo = 7n;
      expect(el.foo).toBe(7n);
      el.foo = undefined as any;
      expect(el.foo).toBe(0n);
    });
  });

  describe("boolean()", () => {
    test("as attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(boolean()) accessor foo = false;
      }
      const el = new Test();
      expect(el.foo).toBe(false);
      expect(el.getAttribute("foo")).toBe(null);
      el.foo = true;
      expect(el.foo).toBe(true);
      expect(el.getAttribute("foo")).toBe("");
      el.removeAttribute("foo");
      expect(el.foo).toBe(false);
      el.setAttribute("foo", "whatever");
      expect(el.foo).toBe(true);
      el.setAttribute("foo", "");
      expect(el.foo).toBe(true);
      el.foo = 0 as any;
      expect(el.foo).toBe(false);
      expect(el.getAttribute("foo")).toBe(null);
    });
  });

  describe("literal()", () => {
    test("invalid options", () => {
      // No valid values
      expect(
        () =>
          class extends HTMLElement {
            @attr(literal({ values: [], transformer: string() }))
            accessor foo = "A";
          }
      ).toThrow();
      // Invalid transformer
      expect(
        () =>
          class extends HTMLElement {
            @attr(literal({ values: ["B", "B", "C"], transformer: {} } as any))
            accessor foo = "A";
          }
      ).toThrow();
    });

    test("as attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(literal({ values: ["A", "B"], transformer: string() }))
        accessor foo = "A";
      }
      const el = new Test();
      expect(el.foo).toBe("A");
      expect(el.getAttribute("foo")).toBe(null);
      el.foo = "B";
      expect(el.foo).toBe("B");
      expect(el.getAttribute("foo")).toBe("B");
      expect(() => {
        el.foo = "C";
      }).toThrow();
      el.setAttribute("foo", "A");
      expect(el.foo).toBe("A");
      expect(el.getAttribute("foo")).toBe("A");
      el.removeAttribute("foo");
      expect(el.foo).toBe("A");
      expect(el.getAttribute("foo")).toBe(null);
      el.setAttribute("foo", "C");
      expect(el.foo).toBe("A");
      expect(el.getAttribute("foo")).toBe("C");
    });

    test("custom fallback value", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(literal({ values: ["A", "B", "C"], transformer: string() }))
        accessor foo = "C";
      }
      const el = new Test();
      el.foo = "B";
      expect(el.getAttribute("foo")).toBe("B");
      el.removeAttribute("foo");
      expect(el.foo).toBe("C");
    });

    test("non-initialized accessor", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(literal({ values: ["A", "B", "C"], transformer: string() }))
        accessor foo: any;
      }
      const el = new Test();
      expect(el.foo).toBe("A");
      el.foo = "C";
      expect(el.getAttribute("foo")).toBe("C");
      el.removeAttribute("foo");
      expect(el.foo).toBe("A");
      el.foo = "B";
      expect(el.foo).toBe("B");
      el.foo = undefined as any;
      expect(el.foo).toBe("A");
    });
  });

  describe("record()", () => {
    test("as attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(record())
        accessor foo = { user: "", email: "" };
      }
      const el = new Test();
      expect(el.foo).toEqual({ user: "", email: "" });
      expect(el.getAttribute("foo")).toBe(null);
      el.foo = { user: "Foo", email: "a@b.c" };
      expect(el.foo).toEqual({ user: "Foo", email: "a@b.c" });
      expect(el.getAttribute("foo")).toBe(`{"user":"Foo","email":"a@b.c"}`);
      expect(() => {
        el.foo = "Hello" as any;
      }).toThrow(TypeError);
      el.setAttribute("foo", "whatever");
      expect(el.foo).toEqual({ user: "", email: "" });
      expect(el.getAttribute("foo")).toBe("whatever");
      el.removeAttribute("foo");
      expect(el.foo).toEqual({ user: "", email: "" });
      expect(el.getAttribute("foo")).toBe(null);
      el.setAttribute("foo", `{ "foo": 42 }`);
      expect(el.foo).toEqual({ foo: 42 });
      expect(el.getAttribute("foo")).toBe(`{ "foo": 42 }`);
    });
  });

  describe("event()", () => {
    test("throw when used with an name without 'on' prefix", async () => {
      expect(() => {
        @define(generateTagName())
        class Test extends HTMLElement {
          @attr(event())
          accessor foo: ((evt: Event) => void) | null = null;
        }
        new Test();
      }).toThrow();
    });

    test("use via property", async () => {
      const spy = jest.fn();
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(event())
        accessor onfoo: ((evt: Event) => void) | null = null;
      }
      const el = new Test();
      expect(el.onfoo).toBe(null);
      const eventHandler = (evt: Event) => spy(evt);
      el.onfoo = eventHandler;
      expect(el.onfoo).toBe(eventHandler);
      expect(el.getAttribute("onfoo")).toBe(null);
      el.dispatchEvent(new Event("foo"));
      expect(spy).toHaveBeenCalledTimes(1);
      el.onfoo = null;
      expect(el.onfoo).toBe(null);
      expect(el.getAttribute("onfoo")).toBe(null);
      el.dispatchEvent(new Event("foo"));
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test("use via attribute", async () => {
      const spy = jest.fn();
      (globalThis as any).fnForEventHandlerAttrTest = spy;
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(event())
        accessor onfoo: ((evt: Event) => void) | null = null;
      }
      const el = new Test();
      el.setAttribute("onfoo", "globalThis.fnForEventHandlerAttrTest(event)");
      expect(el.onfoo?.toString()).toContain(
        "globalThis.fnForEventHandlerAttrTest(event)"
      );
      const evt1 = new Event("foo");
      el.dispatchEvent(evt1);
      expect(spy.mock.calls).toEqual([[evt1]]);
      el.removeAttribute("onfoo");
      expect(el.onfoo).toBe(null);
      el.dispatchEvent(new Event("foo"));
      expect(spy.mock.calls).toEqual([[evt1]]);
    });

    test("use via attribute and property", async () => {
      const spy = jest.fn();
      (globalThis as any).fnForEventHandlerAttrAndPropTest = spy;
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(event())
        accessor onfoo: ((evt: Event) => void) | null = null;
      }
      const el = new Test();
      el.setAttribute(
        "onfoo",
        "globalThis.fnForEventHandlerAttrAndPropTest(event)"
      );
      expect(el.onfoo?.toString()).toContain(
        "globalThis.fnForEventHandlerAttrAndPropTest(event)"
      );
      const evt1 = new Event("foo");
      el.dispatchEvent(evt1);
      expect(spy.mock.calls).toEqual([[evt1]]);
      el.onfoo = (event) => spy(event);
      expect(el.getAttribute("onfoo")).toBe(
        "globalThis.fnForEventHandlerAttrAndPropTest(event)"
      );
      const evt2 = new Event("foo");
      el.dispatchEvent(evt2);
      expect(spy.mock.calls).toEqual([[evt1], [evt2]]);
      el.removeAttribute("onfoo");
      expect(el.onfoo).toBe(null);
    });

    test("event order", async () => {
      const e1 = jest.fn(); // added before first inline event handler
      const e2 = jest.fn(); // inline event handler
      const e3 = jest.fn(); // added after first inline event handler
      (globalThis as any).fnForEventHandlerOrderTest = e2;
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(event())
        accessor onfoo: ((evt: Event) => void) | null = null;
      }
      const el = new Test();
      el.addEventListener("foo", e1);
      el.onfoo = (event) => e2(event);
      el.addEventListener("foo", e3);
      el.dispatchEvent(new Event("foo"));
      expect(e1.mock.invocationCallOrder[0]).toBeLessThan(
        e2.mock.invocationCallOrder[0]
      );
      expect(e2.mock.invocationCallOrder[0]).toBeLessThan(
        e3.mock.invocationCallOrder[0]
      );
      // Swap in place should keep the order
      el.onfoo = (event) => e2(event);
      el.dispatchEvent(new Event("foo"));
      expect(e1.mock.invocationCallOrder[1]).toBeLessThan(
        e2.mock.invocationCallOrder[1]
      );
      expect(e2.mock.invocationCallOrder[1]).toBeLessThan(
        e3.mock.invocationCallOrder[1]
      );
      // Deletion and re-setting should place the new event handler at the end
      el.onfoo = null;
      el.onfoo = (event) => e2(event);
      el.dispatchEvent(new Event("foo"));
      expect(e1.mock.invocationCallOrder[2]).toBeLessThan(
        e2.mock.invocationCallOrder[2]
      );
      expect(e3.mock.invocationCallOrder[2]).toBeLessThan(
        e2.mock.invocationCallOrder[2]
      );
    });

    test("preventDefault() via return false", async () => {
      const spy = jest.fn();
      class MyEvent extends Event {
        preventDefault() {
          spy();
        }
      }
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(event())
        accessor onspecialevent: ((evt: MyEvent) => void) | null = null;
        accessor onnormalevent: ((evt: MyEvent) => void) | null = null;
      }
      const el = new Test();
      el.setAttribute("onspecialevent", "return false");
      el.setAttribute("onnormalevent", "return 42");
      el.dispatchEvent(new MyEvent("specialevent"));
      el.dispatchEvent(new MyEvent("normalevent"));
      await wait();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
