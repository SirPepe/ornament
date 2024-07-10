import { expect } from "@esm-bundle/chai";
import { spy } from "sinon";
import {
  attr,
  debounce,
  define,
  enhance,
  prop,
  reactive,
  href,
  number,
  string,
} from "../src/index.js";
import { generateTagName } from "./helpers.js";
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
