import { expect } from "@esm-bundle/chai";
import { spy } from "sinon";
import { define, prop, number, state } from "../src/index.js";
import { generateTagName } from "./helpers.js";
const test = it;

describe("Decorators", () => {
  describe("@state", () => {
    test("toggle custom state", () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @state()
        accessor foo: any = true;
      }
      const el = new Test();
      expect(el.matches(`:state(foo)`)).to.equal(true);
      el.foo = false;
      expect(el.matches(`:state(foo)`)).to.equal(false);
      el.foo = "Truthy";
      expect(el.matches(`:state(foo)`)).to.equal(true);
      el.foo = null;
      expect(el.matches(`:state(foo)`)).to.equal(false);
    });

    test("toggle custom state (private fields)", () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @state()
        accessor #foo: any = true;
        setFoo(value: any) {
          this.#foo = value;
        }
      }
      const el = new Test();
      expect(el.matches(`:state(\\#foo)`)).to.equal(true);
      el.setFoo(false);
      expect(el.matches(`:state(\\#foo)`)).to.equal(false);
      el.setFoo("Truthy");
      expect(el.matches(`:state(\\#foo)`)).to.equal(true);
      el.setFoo(null);
      expect(el.matches(`:state(\\#foo)`)).to.equal(false);
    });

    test("custom toBoolean() called with appropriate arguments and 'this' value", () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @state({
          toBoolean(value, instance) {
            fn(this, value, instance);
            return value % 2 === 0;
          },
        })
        accessor foo = 0;
      }
      const el = new Test();
      expect(el.matches(`:state(foo)`)).to.equal(true);
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql([el, 0, el]);
      el.foo = 1;
      expect(el.matches(`:state(foo)`)).to.equal(false);
      expect(fn.callCount).to.equal(2);
      expect(fn.getCalls()[1].args).to.eql([el, 1, el]);
    });

    test("with @prop", () => {
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(number({ min: 0 }))
        @state({ toBoolean: (x) => x % 2 === 0 })
        accessor foo = 0;
      }
      const el = new Test();
      expect(el.matches(`:state(foo)`)).to.equal(true);
      el.foo = 1;
      expect(el.matches(`:state(foo)`)).to.equal(false);
      expect(() => {
        el.foo = -2;
      }).to.throw();
      expect(el.matches(`:state(foo)`)).to.equal(false);
    });

    test("fails when used on symbols without name option", () => {
      expect(() => {
        const key = Symbol();
        @define(generateTagName())
        class Test extends HTMLElement {
          @state()
          accessor [key]: any = true;
        }
      }).to.throw();
    });

    test("works when used on symbols with the name option", () => {
      const key = Symbol();
      @define(generateTagName())
      class Test extends HTMLElement {
        @state({ name: "foo" })
        accessor [key]: any = true;
      }
      const el = new Test();
      expect(el.matches(`:state(foo)`)).to.equal(true);
      el[key] = false;
      expect(el.matches(`:state(foo)`)).to.equal(false);
      el[key] = "Truthy";
      expect(el.matches(`:state(foo)`)).to.equal(true);
      el[key] = null;
      expect(el.matches(`:state(foo)`)).to.equal(false);
    });
  });
});
