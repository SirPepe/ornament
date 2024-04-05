import { expect } from "@esm-bundle/chai";
import { spy } from "sinon";
import {
  attr,
  prop,
  define,
  bool,
  event,
  href,
  int,
  literal,
  number,
  json,
  string,
  list,
  any,
  reactive,
  init,
} from "../src/index.js";
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
      el.foo = undefined as any;
      expect(el.foo).to.equal("undefined");
      expect(el.getAttribute("foo")).to.equal("undefined");
    });

    test("with initial value", async () => {
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
      expect(el.foo).to.equal("undefined");
    });

    test("from HTML", async () => {
      const tagName = generateTagName();
      @define(tagName)
      class Test extends HTMLElement {
        @attr(string()) accessor foo = "";
      }
      const fixture = document.createElement("div");
      fixture.innerHTML = `<${tagName} foo="hello"></${tagName}>`;
      expect((fixture.children[0] as any).foo).to.equal("hello");
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

    test("with default value", async () => {
      const tagName = generateTagName();
      @define(tagName)
      class Test extends HTMLElement {
        @attr(href()) accessor foo = "https://example.com/asdf";
      }
      const el = new Test();
      expect(el.foo).to.equal("https://example.com/asdf");
      el.setAttribute("foo", "https://www.peterkroener.de/");
      expect(el.foo).to.equal("https://www.peterkroener.de/");
      el.removeAttribute("foo");
      expect(el.foo).to.equal("https://example.com/asdf");
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
            @attr(number({ min: 1, max: -1 })) accessor foo = 1;
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
      expect(el.foo).to.equal(3);
      expect(() => {
        el.foo = NaN;
      }).to.throw();
    });

    test("as nullable attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(number({ nullable: true }))
        accessor foo: null | undefined | number = 0;
      }
      const el = new Test();
      expect(el.foo).to.equal(0);
      expect(el.getAttribute("foo")).to.equal(null);
      el.foo = 1;
      expect(el.foo).to.equal(1);
      expect(el.getAttribute("foo")).to.equal("1");
      el.foo = null;
      expect(el.foo).to.equal(null);
      expect(el.getAttribute("foo")).to.equal(null);
      el.setAttribute("foo", "2");
      expect(el.foo).to.equal(2);
      el.setAttribute("foo", "2.22");
      expect(el.foo).to.equal(2.22);
      el.setAttribute("foo", "0");
      expect(el.foo).to.equal(0);
      el.foo = undefined;
      expect(el.foo).to.equal(null);
      expect(el.getAttribute("foo")).to.equal(null);
      el.setAttribute("foo", "Infinity");
      expect(el.foo).to.equal(Infinity);
      el.removeAttribute("foo");
      expect(el.foo).to.equal(null);
      expect(el.getAttribute("foo")).to.equal(null);
      el.foo = 3;
      el.setAttribute("foo", "asdf");
      expect(el.foo).to.equal(3);
      expect(() => {
        el.foo = NaN;
      }).to.throw();
    });

    test("as attribute with NaN", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(number({ allowNaN: true })) accessor foo = 0;
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
      expect(Number.isNaN(el.foo)).to.equal(true);
      el.foo = 3;
      expect(el.foo).to.equal(3);
      expect(el.getAttribute("foo")).to.equal("3");
      el.foo = NaN;
      expect(Number.isNaN(el.foo)).to.equal(true);
      expect(el.getAttribute("foo")).to.equal("NaN");
      el.foo = 3;
      el.setAttribute("foo", "NaN");
      expect(Number.isNaN(el.foo)).to.equal(true);
      expect(el.getAttribute("foo")).to.equal("NaN");
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

    test("min/max set to nullish values", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(number({ min: null, max: void 0 })) accessor foo = 0;
      }
      const el = new Test();
      el.foo = Infinity;
      el.foo = -Infinity;
    });

    test("min/max when nullable", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(number({ min: 0, max: 10, nullable: true }))
        accessor foo: number | null | undefined = 0;
      }
      const el = new Test();
      expect(() => {
        el.foo = -1;
      }).to.throw();
      el.setAttribute("foo", "22");
      expect(el.foo).to.equal(10);
    });

    test("min/max with NaN", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(number({ min: 0, max: 10, allowNaN: true })) accessor foo = 0;
      }
      const el = new Test();
      expect(() => {
        el.foo = -1;
      }).to.throw();
      el.setAttribute("foo", "22");
      expect(el.foo).to.equal(10);
      el.foo = NaN;
      expect(Number.isNaN(el.foo)).to.equal(true);
      expect(el.getAttribute("foo")).to.equal("NaN");
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
      el.foo = 0;
      expect(el.foo).to.equal(0);
    });

    test("non-initialized accessor when nullable", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(number({ nullable: true })) accessor foo: any;
      }
      const el = new Test();
      expect(el.foo).to.equal(null);
      el.foo = 7;
      expect(el.getAttribute("foo")).to.equal("7");
      el.removeAttribute("foo");
      expect(el.foo).to.equal(null);
    });

    test("initial value out of range", async () => {
      expect(() => {
        @define(generateTagName())
        class Test extends HTMLElement {
          @attr(number({ max: 5 })) accessor foo = 10;
        }
        const el = new Test();
      }).to.throw();
    });

    test("initial value set to out of range non-allowed NaN", async () => {
      expect(() => {
        @define(generateTagName())
        class Test extends HTMLElement {
          @attr(number({ max: 5 })) accessor foo = NaN;
        }
        const el = new Test();
      }).to.throw();
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
      el.foo = 0n;
      expect(el.foo).to.equal(0n);
      el.setAttribute("foo", "2");
      expect(el.foo).to.equal(2n);
      el.setAttribute("foo", "5.75");
      expect(el.foo).to.equal(5n);
      expect(() => {
        el.foo = 5.55 as any;
      }).to.throw();
      el.setAttribute("foo", "sfhuehueghugeh");
      expect(el.foo).to.equal(5n);
      el.setAttribute("foo", "3");
      expect(el.foo).to.equal(3n);
      el.foo = "1" as any;
      expect(el.foo).to.equal(1n);
      el.removeAttribute("foo");
      expect(el.foo).to.equal(0n);
    });

    test("initialize from attribute", async () => {
      const fn = spy();
      const tagName = generateTagName();
      @define(tagName)
      class Test extends HTMLElement {
        @attr(int()) accessor foo: any;
        @init() method() {
          fn(this.foo);
        }
      }
      const fixture = document.createElement("div");
      document.body.append(fixture);
      fixture.innerHTML = `<${tagName} foo="0"></${tagName}>`;
      const el = fixture.children[0] as Test;
      expect(el.foo).to.equal(0n);
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql([0n]);
    });

    test("as nullable attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(int({ nullable: true }))
        accessor foo: bigint | null | undefined = 0n;
      }
      const el = new Test();
      expect(el.foo).to.equal(0n);
      expect(el.getAttribute("foo")).to.equal(null);
      el.foo = 1n;
      expect(el.foo).to.equal(1n);
      expect(el.getAttribute("foo")).to.equal("1");
      el.foo = null;
      expect(el.foo).to.equal(null);
      expect(el.getAttribute("foo")).to.equal(null);
      el.setAttribute("foo", "5.75");
      expect(el.foo).to.equal(5n);
      el.foo = undefined;
      expect(el.foo).to.equal(null);
      expect(el.getAttribute("foo")).to.equal(null);
      expect(() => {
        el.foo = 5.55 as any;
      }).to.throw();
      el.foo = "1" as any;
      expect(el.foo).to.equal(1n);
      expect(el.getAttribute("foo")).to.equal("1");
      el.setAttribute("foo", "sfhuehueghugeh");
      expect(el.foo).to.equal(1n);
      el.removeAttribute("foo");
      expect(el.foo).to.equal(null);
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

    test("min/max set to nullish values", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(int({ min: null, max: void 0 })) accessor foo = 0n;
      }
      const el = new Test();
      el.foo = 10000000000000000000000000n;
      el.foo = -10000000000000000000000000n;
    });

    test("min/max when nullable", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(int({ min: 0n, max: 10n, nullable: true }))
        accessor foo: bigint | null | undefined = 0n;
      }
      const el = new Test();
      expect(() => {
        el.foo = -1n;
      }).to.throw();
      el.setAttribute("foo", "22");
      expect(el.foo).to.equal(10n);
      el.foo = null;
      expect(el.foo).to.equal(null);
      expect(el.getAttribute("foo")).to.equal(null);
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
      el.foo = 0n;
      expect(el.foo).to.equal(0n);
    });

    test("non-initialized accessor when nullable", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(int({ nullable: true })) accessor foo: any;
      }
      const el = new Test();
      expect(el.foo).to.equal(null);
      el.foo = 7n;
      expect(el.getAttribute("foo")).to.equal("7");
      el.removeAttribute("foo");
      expect(el.foo).to.equal(null);
    });

    test("initial value out of range", async () => {
      expect(() => {
        @define(generateTagName())
        class Test extends HTMLElement {
          @attr(int({ max: 5n })) accessor foo = 10n;
        }
        const el = new Test();
      }).to.throw();
    });
  });

  describe("bool()", () => {
    test("as attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(bool()) accessor foo = false;
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
            @attr(literal({ values: [], transform: string() }))
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
        @attr(literal({ values: ["A", "B"], transform: string() }))
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
      el.setAttribute("foo", "B");
      expect(el.foo).to.equal("B");
      el.setAttribute("foo", "C");
      expect(el.foo).to.equal("B");
      expect(el.getAttribute("foo")).to.equal("C");
    });

    test("custom fallback value", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(literal({ values: ["A", "B", "C"], transform: string() }))
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
        @attr(literal({ values: ["A", "B", "C"], transform: string() }))
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
    });
  });

  describe("json()", () => {
    test("as attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(json())
        accessor foo = { user: "", email: "" };
      }
      const el = new Test();
      expect(el.foo).to.eql({ user: "", email: "" });
      expect(el.getAttribute("foo")).to.equal(null);
      el.foo = { user: "Foo", email: "a@b.c" };
      expect(el.foo).to.eql({ user: "Foo", email: "a@b.c" });
      expect(el.getAttribute("foo")).to.equal(`{"user":"Foo","email":"a@b.c"}`);
      expect(() => {
        el.foo = {
          toJSON() {
            throw new Error();
          },
        } as any;
      }).to.throw(Error);
      el.setAttribute("foo", "whatever");
      expect(el.foo).to.eql({ user: "Foo", email: "a@b.c" });
      expect(el.getAttribute("foo")).to.equal("whatever");
      el.removeAttribute("foo");
      expect(el.foo).to.eql({ user: "", email: "" });
      expect(el.getAttribute("foo")).to.equal(null);
      el.setAttribute("foo", `{ "foo": 42 }`);
      expect(el.foo).to.eql({ foo: 42 });
      expect(el.getAttribute("foo")).to.equal(`{ "foo": 42 }`);
    });

    test("as attribute, initializing empty", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(json())
        accessor foo: any;
      }
      const el = new Test();
      expect(el.foo).to.equal(undefined);
      el.foo = { a: 1 };
      expect(el.getAttribute("foo")).to.equal('{"a":1}');
      el.foo = undefined;
      expect(el.getAttribute("foo")).to.equal("undefined");
    });

    test("content attribute throws for invalid json", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(json())
        accessor foo: any = null;
      }
      const el = new Test();
      expect(el.foo).to.equal(null);
      expect(() => {
        el.foo = {
          test: 1n,
        } as any;
      }).to.throw(Error);
    });

    test("content attribute throws for invalid initial json", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(json())
        accessor foo = { test: 1n };
      }
      expect(() => new Test()).to.throw(Error);
    });

    test("IDL attribute accepts invalid json", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(json())
        accessor foo: any = null;
      }
      const el = new Test();
      expect(el.foo).to.equal(null);
      el.foo = { test: 1n };
      expect(el.foo).to.eql({ test: 1n });
    });

    test("IDL attribute accepts invalid initial json", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(json())
        accessor foo = { test: 1n };
      }
      new Test();
    });
  });

  describe("list()", () => {
    test("list of comma-separated numbers as attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(list({ transform: number() })) accessor foo = [0];
      }
      const el = new Test();
      expect(el.foo).to.eql([0]);
      el.setAttribute("foo", "2, 4, 8");
      expect(el.foo).to.eql([2, 4, 8]);
      el.foo = [1, 2, 3];
      expect(el.foo).to.eql([1, 2, 3]);
      expect(el.getAttribute("foo")).to.eql("1,2,3");
      expect(() => {
        (el as any).foo = "asdf";
      }).to.throw();
      expect(() => {
        (el as any).foo = ["asdf"];
      }).to.throw();
      expect(el.foo).to.eql([1, 2, 3]);
      expect(el.getAttribute("foo")).to.eql("1,2,3");
      el.setAttribute("foo", "7");
      expect(el.foo).to.eql([7]);
      el.setAttribute("foo", "asdf");
      expect(el.foo).to.eql([]);
      el.setAttribute("foo", "   1, , ,,2   ,3     ");
      expect(el.foo).to.eql([1, 2, 3]);
      el.setAttribute("foo", "");
      expect(el.foo).to.eql([]);
      el.removeAttribute("foo");
      expect(el.foo).to.eql([0]);
      el.foo = [1, 2];
      expect(el.getAttribute("foo")).to.eql("1,2");
      el.foo = [];
      expect(el.getAttribute("foo")).to.eql("");
    });

    test("list of space-separated strings as attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(list({ transform: string(), separator: " " })) accessor foo = [
          "a",
        ];
      }
      const el = new Test();
      expect(el.foo).to.eql(["a"]);
      el.setAttribute("foo", " a  b  c   ");
      expect(el.foo).to.eql(["a", "b", "c"]);
      expect(() => {
        (el as any).foo = 1;
      }).to.throw();
      (el as any).foo = [1, 2, 3];
      expect(el.foo).to.eql(["1", "2", "3"]);
    });
  });

  describe("any()", () => {
    test("as attribute", async () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @attr(any()) accessor foo: any = 42;
      }
      const el = new Test();
      expect(el.foo).to.equal(42);
      expect(el.getAttribute("foo")).to.equal(null);
      el.foo = "A";
      expect(el.foo).to.equal("A");
      expect(el.getAttribute("foo")).to.equal("A");
      el.removeAttribute("foo");
      expect(el.foo).to.equal(null);
      expect(el.getAttribute("foo")).to.equal(null);
      el.foo = "A";
      el.foo = "";
      expect(el.foo).to.equal("");
      expect(el.getAttribute("foo")).to.equal("");
      el.foo = null;
      expect(el.foo).to.equal(null);
      expect(el.getAttribute("foo")).to.equal("null");
      el.foo = false;
      expect(el.foo).to.equal(false);
      expect(el.getAttribute("foo")).to.equal("false");
      el.foo = [1, 2, 3];
      expect(el.foo).to.eql([1, 2, 3]);
      expect(el.getAttribute("foo")).to.equal("1,2,3");
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
