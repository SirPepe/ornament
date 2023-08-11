import { expect } from "@esm-bundle/chai";
import { spy } from "sinon";
import { attr, define } from "../src/decorators.js";
import {
  boolean,
  event,
  href,
  int,
  literal,
  number,
  record,
  string,
} from "../src/transformers.js";
import { generateTagName, wait } from "./helpers.js";
const test = it;

describe("Transformers", () => {
  describe("string()", () => {
    test("as attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string()) accessor foo = "";
      }
      const el = new Test();
      expect(el.foo).to.equal("");
      expect(el.getAttribute("foo")).to.equal(null);
      el.foo = "A";
      expect(el.foo).to.equal("A");
      expect(el.getAttribute("foo")).to.equal("A");
      el.setAttribute("foo", "B");
      expect(el.foo).to.equal("B");
      expect(el.getAttribute("foo")).to.equal("B");
      el.removeAttribute("foo");
      expect(el.foo).to.equal("");
      expect(el.getAttribute("foo")).to.equal(null);
      el.foo = "A";
      el.foo = "";
      expect(el.foo).to.equal("");
      expect(el.getAttribute("foo")).to.equal("");
      el.foo = null as any;
      expect(el.foo).to.equal("null");
      expect(el.getAttribute("foo")).to.equal("null");
      el.foo = false as any;
      expect(el.foo).to.equal("false");
      expect(el.getAttribute("foo")).to.equal("false");
    });

    test("custom fallback value", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string()) accessor foo = "default";
      }
      const el = new Test();
      el.foo = "Hello";
      expect(el.getAttribute("foo")).to.equal("Hello");
      el.removeAttribute("foo");
      expect(el.foo).to.equal("default");
    });

    test("non-initialized accessor", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(string()) accessor foo: any;
      }
      const el = new Test();
      expect(el.foo).to.equal("");
      el.foo = "Hello";
      expect(el.getAttribute("foo")).to.equal("Hello");
      el.removeAttribute("foo");
      expect(el.foo).to.equal("");
      el.foo = "Hello";
      expect(el.foo).to.equal("Hello");
      el.foo = undefined as any;
      expect(el.foo).to.equal("");
    });
  });

  describe("href()", () => {
    test("as attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(href()) accessor foo = "";
      }
      const el = new Test();
      expect(el.foo).to.equal("");
      expect(el.getAttribute("foo")).to.equal(null);
      el.foo = "";
      expect(el.foo).to.equal(window.location.href);
      expect(el.getAttribute("foo")).to.equal("");
      el.setAttribute("foo", "asdf");
      expect(el.foo).to.equal(`${window.location.origin}/asdf`);
      expect(el.getAttribute("foo")).to.equal("asdf");
      el.removeAttribute("foo");
      expect(el.foo).to.equal("");
      el.foo = "https://example.com/asdf/";
      expect(el.foo).to.equal("https://example.com/asdf/");
    });

    test("from HTML", async () => {
      const tagName = generateTagName();
      @define(tagName)
      class Test extends HTMLElement {
        @attr(href()) accessor foo = "";
      }
      const fixture = document.createElement("div");
      fixture.innerHTML = `<${tagName} foo="https://example.com/asdf"></${tagName}>`;
      expect((fixture.children[0] as any).foo).to.equal(
        "https://example.com/asdf",
      );
    });
  });

  describe("number()", () => {
    test("invalid options", () => {
      // min/max contradictions
      expect(
        () =>
          class extends HTMLElement {
            @attr(number({ min: 1, max: 0 })) accessor foo = 1;
          },
      ).to.throw();
      expect(
        () =>
          class extends HTMLElement {
            @attr(number({ min: 1, max: 1 })) accessor foo = 1;
          },
      ).to.throw();
      // Invalid initial value
      expect(() => {
        @define(generateTagName())
        class Test extends HTMLElement {
          @attr(number({ min: 0, max: 10 })) accessor foo = -7;
        }
        new Test();
      }).to.throw();
    });

    test("as attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(number()) accessor foo = 0;
      }
      const el = new Test();
      expect(el.foo).to.equal(0);
      expect(el.getAttribute("foo")).to.equal(null);
      el.foo = 1;
      expect(el.foo).to.equal(1);
      expect(el.getAttribute("foo")).to.equal("1");
      el.setAttribute("foo", "2");
      expect(el.foo).to.equal(2);
      el.setAttribute("foo", "2.22");
      expect(el.foo).to.equal(2.22);
      el.removeAttribute("foo");
      expect(el.foo).to.equal(0);
      expect(el.getAttribute("foo")).to.equal(null);
      el.foo = 3;
      el.setAttribute("foo", "asdf");
      expect(el.foo).to.equal(0);
    });

    test("min/max", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(number({ min: 0, max: 10 })) accessor foo = 0;
      }
      const el = new Test();
      expect(() => {
        el.foo = -1;
      }).to.throw();
      el.setAttribute("foo", "22");
      expect(el.foo).to.equal(10);
    });

    test("custom fallback value", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(number()) accessor foo = 7;
      }
      const el = new Test();
      el.foo = 8;
      expect(el.getAttribute("foo")).to.equal("8");
      el.removeAttribute("foo");
      expect(el.foo).to.equal(7);
    });

    test("non-initialized accessor", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(number()) accessor foo: any;
      }
      const el = new Test();
      expect(el.foo).to.equal(0);
      el.foo = 7;
      expect(el.getAttribute("foo")).to.equal("7");
      el.removeAttribute("foo");
      expect(el.foo).to.equal(0);
      el.foo = 7;
      expect(el.foo).to.equal(7);
      el.foo = undefined as any;
      expect(el.foo).to.equal(0);
    });
  });

  describe("int()", () => {
    test("as attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(int()) accessor foo = 0n;
      }
      const el = new Test();
      expect(el.foo).to.equal(0n);
      expect(el.getAttribute("foo")).to.equal(null);
      el.foo = 1n;
      expect(el.foo).to.equal(1n);
      expect(el.getAttribute("foo")).to.equal("1");
      el.setAttribute("foo", "2");
      expect(el.foo).to.equal(2n);
      el.setAttribute("foo", "2.75");
      expect(el.foo).to.equal(0n);
      el.setAttribute("foo", "3");
      expect(el.foo).to.equal(3n);
      el.removeAttribute("foo");
      expect(el.foo).to.equal(0n);
    });

    test("min/max", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(int({ min: 0n, max: 10n })) accessor foo = 0n;
      }
      const el = new Test();
      expect(() => {
        el.foo = -1n;
      }).to.throw();
      el.setAttribute("foo", "22");
      expect(el.foo).to.equal(10n);
    });

    test("custom fallback value", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(int()) accessor foo = 7n;
      }
      const el = new Test();
      el.foo = 8n;
      expect(el.getAttribute("foo")).to.equal("8");
      el.removeAttribute("foo");
      expect(el.foo).to.equal(7n);
    });

    test("non-initialized accessor", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(int()) accessor foo: any;
      }
      const el = new Test();
      expect(el.foo).to.equal(0n);
      el.foo = 7n;
      expect(el.getAttribute("foo")).to.equal("7");
      el.removeAttribute("foo");
      expect(el.foo).to.equal(0n);
      el.foo = 7n;
      expect(el.foo).to.equal(7n);
      el.foo = undefined as any;
      expect(el.foo).to.equal(0n);
    });
  });

  describe("boolean()", () => {
    test("as attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(boolean()) accessor foo = false;
      }
      const el = new Test();
      expect(el.foo).to.equal(false);
      expect(el.getAttribute("foo")).to.equal(null);
      el.foo = true;
      expect(el.foo).to.equal(true);
      expect(el.getAttribute("foo")).to.equal("");
      el.removeAttribute("foo");
      expect(el.foo).to.equal(false);
      el.setAttribute("foo", "whatever");
      expect(el.foo).to.equal(true);
      el.setAttribute("foo", "");
      expect(el.foo).to.equal(true);
      el.foo = 0 as any;
      expect(el.foo).to.equal(false);
      expect(el.getAttribute("foo")).to.equal(null);
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
          },
      ).to.throw();
      // Invalid transformer
      expect(
        () =>
          class extends HTMLElement {
            @attr(literal({ values: ["B", "B", "C"], transformer: {} } as any))
            accessor foo = "A";
          },
      ).to.throw();
    });

    test("as attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(literal({ values: ["A", "B"], transformer: string() }))
        accessor foo = "A";
      }
      const el = new Test();
      expect(el.foo).to.equal("A");
      expect(el.getAttribute("foo")).to.equal(null);
      el.foo = "B";
      expect(el.foo).to.equal("B");
      expect(el.getAttribute("foo")).to.equal("B");
      expect(() => {
        el.foo = "C";
      }).to.throw();
      el.setAttribute("foo", "A");
      expect(el.foo).to.equal("A");
      expect(el.getAttribute("foo")).to.equal("A");
      el.removeAttribute("foo");
      expect(el.foo).to.equal("A");
      expect(el.getAttribute("foo")).to.equal(null);
      el.setAttribute("foo", "C");
      expect(el.foo).to.equal("A");
      expect(el.getAttribute("foo")).to.equal("C");
    });

    test("custom fallback value", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(literal({ values: ["A", "B", "C"], transformer: string() }))
        accessor foo = "C";
      }
      const el = new Test();
      el.foo = "B";
      expect(el.getAttribute("foo")).to.equal("B");
      el.removeAttribute("foo");
      expect(el.foo).to.equal("C");
    });

    test("non-initialized accessor", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(literal({ values: ["A", "B", "C"], transformer: string() }))
        accessor foo: any;
      }
      const el = new Test();
      expect(el.foo).to.equal("A");
      el.foo = "C";
      expect(el.getAttribute("foo")).to.equal("C");
      el.removeAttribute("foo");
      expect(el.foo).to.equal("A");
      el.foo = "B";
      expect(el.foo).to.equal("B");
      el.foo = undefined as any;
      expect(el.foo).to.equal("A");
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
      expect(el.foo).to.eql({ user: "", email: "" });
      expect(el.getAttribute("foo")).to.equal(null);
      el.foo = { user: "Foo", email: "a@b.c" };
      expect(el.foo).to.eql({ user: "Foo", email: "a@b.c" });
      expect(el.getAttribute("foo")).to.equal(`{"user":"Foo","email":"a@b.c"}`);
      expect(() => {
        el.foo = "Hello" as any;
      }).to.throw(TypeError);
      el.setAttribute("foo", "whatever");
      expect(el.foo).to.eql({ user: "", email: "" });
      expect(el.getAttribute("foo")).to.equal("whatever");
      el.removeAttribute("foo");
      expect(el.foo).to.eql({ user: "", email: "" });
      expect(el.getAttribute("foo")).to.equal(null);
      el.setAttribute("foo", `{ "foo": 42 }`);
      expect(el.foo).to.eql({ foo: 42 });
      expect(el.getAttribute("foo")).to.equal(`{ "foo": 42 }`);
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
      }).to.throw();
    });

    test("use via property", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(event())
        accessor onfoo: ((evt: Event) => void) | null = null;
      }
      const el = new Test();
      expect(el.onfoo).to.equal(null);
      const eventHandler = (evt: Event) => fn(evt);
      el.onfoo = eventHandler;
      expect(el.onfoo).to.equal(eventHandler);
      expect(el.getAttribute("onfoo")).to.equal(null);
      el.dispatchEvent(new Event("foo"));
      expect(fn.callCount).to.equal(1);
      el.onfoo = null;
      expect(el.onfoo).to.equal(null);
      expect(el.getAttribute("onfoo")).to.equal(null);
      el.dispatchEvent(new Event("foo"));
      expect(fn.callCount).to.equal(1);
    });

    test("use via attribute", async () => {
      const fn = spy();
      (globalThis as any).fnForEventHandlerAttrTest = fn;
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(event())
        accessor onfoo: ((evt: Event) => void) | null = null;
      }
      const el = new Test();
      el.setAttribute("onfoo", "globalThis.fnForEventHandlerAttrTest(event)");
      expect(el.onfoo?.toString()).to.have.string(
        "globalThis.fnForEventHandlerAttrTest(event)",
      );
      const evt1 = new Event("foo");
      el.dispatchEvent(evt1);
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql([evt1]);
      el.removeAttribute("onfoo");
      expect(el.onfoo).to.equal(null);
      el.dispatchEvent(new Event("foo"));
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql([evt1]);
    });

    test("use via attribute and property", async () => {
      const fn = spy();
      (globalThis as any).fnForEventHandlerAttrAndPropTest = fn;
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(event())
        accessor onfoo: ((evt: Event) => void) | null = null;
      }
      const el = new Test();
      el.setAttribute(
        "onfoo",
        "globalThis.fnForEventHandlerAttrAndPropTest(event)",
      );
      expect(el.onfoo?.toString()).to.have.string(
        "globalThis.fnForEventHandlerAttrAndPropTest(event)",
      );
      const evt1 = new Event("foo");
      el.dispatchEvent(evt1);
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql([evt1]);
      el.onfoo = (event) => fn(event);
      expect(el.getAttribute("onfoo")).to.equal(
        "globalThis.fnForEventHandlerAttrAndPropTest(event)",
      );
      const evt2 = new Event("foo");
      el.dispatchEvent(evt2);
      expect(fn.callCount).to.equal(2);
      expect(fn.getCalls()[0].args).to.eql([evt1]);
      expect(fn.getCalls()[1].args).to.eql([evt2]);
      el.removeAttribute("onfoo");
      expect(el.onfoo).to.equal(null);
    });

    test("event order", async () => {
      const e1 = spy(); // added before first inline event handler
      const e2 = spy(); // inline event handler
      const e3 = spy(); // added after first inline event handler
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
      expect(e1.calledBefore(e2)).to.equal(true);
      expect(e2.calledBefore(e3)).to.equal(true);
      // Swap in place should keep the order
      el.onfoo = (event) => e2(event);
      el.dispatchEvent(new Event("foo"));
      expect(e1.callCount).to.equal(2);
      expect(e2.callCount).to.equal(2);
      expect(e3.callCount).to.equal(2);
      expect(e1.calledBefore(e2)).to.equal(true);
      expect(e2.calledBefore(e3)).to.equal(true);
      // Deletion and re-setting should place the new event handler at the end
      el.onfoo = null;
      el.onfoo = (event) => e2(event);
      el.dispatchEvent(new Event("foo"));
      expect(e1.callCount).to.equal(3);
      expect(e2.callCount).to.equal(3);
      expect(e3.callCount).to.equal(3);
      expect(e1.calledBefore(e2)).to.equal(true);
      expect(e3.calledBefore(e2)).to.equal(true);
    });

    test("preventDefault() via return false", async () => {
      const fn = spy();
      class MyEvent extends Event {
        preventDefault() {
          fn();
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
      expect(fn.callCount).to.equal(1);
    });
  });
});
