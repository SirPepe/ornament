import { expect } from "@esm-bundle/chai";
import { spy } from "sinon";
import {
  attr,
  define,
  enhance,
  prop,
  reactive,
  number,
  string,
  init,
} from "../src/index.js";
import { generateTagName } from "./helpers.js";
const test = it;

describe("Inheritance chains", () => {
  describe("@enhance", () => {
    test("enhance only a subclass", () => {
      const fnBase = spy();
      const fnTest = spy();
      class Base extends HTMLElement {
        @prop(number()) accessor foo = 23;
        @reactive() methodBase() {
          fnBase();
        }
      }
      @enhance()
      class Test extends Base {
        @prop(string()) accessor bar = "A";
        @reactive() methodTest() {
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

    test("property access on the base class of an enhanced subclass", () => {
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
      instance.foo = "B";
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql(["B"]);
    });

    test("content attribute access on the base class of an enhanced subclass", () => {
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
      instance.foo = "baz";
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql(["baz"]);
      instance.setAttribute("foo", "foo");
      expect(fn.callCount).to.equal(2);
      expect(fn.getCalls()[1].args).to.eql(["foo"]);
    });

    test("enhance only a base class", () => {
      const fnBase = spy();
      const fnTest = spy();
      @enhance()
      class Base extends HTMLElement {
        @prop(number()) accessor foo = 23;
        @reactive() methodBase() {
          fnBase();
        }
      }
      class Test extends Base {
        @prop(string()) accessor bar = "A";
        @reactive() methodTest() {
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

    test("enhancing the class twice has no adverse effect", () => {
      const fn = spy();
      @enhance()
      @enhance()
      class Test extends HTMLElement {
        @prop(number()) accessor test = 23;
        @reactive() method() {
          fn(); // called *once* if enhance only applies its effect once
        }
      }
      window.customElements.define(generateTagName(), Test);
      const instance = new Test();
      instance.test = 42;
      expect(fn.callCount).to.equal(1);
    });

    test("enhancing a base class and a derived class has no adverse effect", () => {
      const fnBase = spy();
      const fnTest = spy();
      @enhance()
      class Base extends HTMLElement {
        @prop(number()) accessor foo = 23;
        @reactive() methodBase() {
          fnBase(); // called *once* if enhance only applies its effect once
        }
      }
      @enhance()
      class Test extends Base {
        @prop(string()) accessor bar = "A";
        @reactive() methodTest() {
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

    test("Two enhanced classes: all @init() methods run after the *subclass* constructor", () => {
      let x = 0;
      const fnBase = spy();
      const fnTest = spy();
      @enhance()
      class Base extends HTMLElement {
        constructor() {
          super();
          x++;
        }
        @init() // <- triggers when the subclass constructor has finished
        baseMethod() {
          fnBase(x);
        }
      }
      @enhance()
      class Test extends Base {
        constructor() {
          super();
          x++;
        }
        @init()
        extensionMethod() {
          fnTest(x);
        }
      }
      window.customElements.define(generateTagName(), Test);
      new Test();
      expect(x).to.equal(2);
      expect(fnBase.callCount).to.equal(1);
      expect(fnTest.callCount).to.equal(1);
      expect(fnBase.getCalls()[0].args).to.eql([2]);
      expect(fnTest.getCalls()[0].args).to.eql([2]);
    });

    test("Two enhanced classes with something in between: all @init() methods run after the *last* constructor", () => {
      let x = 0;
      const fnA = spy();
      const fnB = spy();
      const fnC = spy();
      @enhance()
      class A extends HTMLElement {
        constructor() {
          super();
          x++;
        }
        @init()
        methodA() {
          fnA(x);
        }
      }
      class B extends A {
        constructor() {
          super();
          x++;
        }
        @init()
        methodB() {
          fnB(x);
        }
      }
      @enhance()
      class C extends B {
        constructor() {
          super();
          x++;
        }
        @init()
        methodC() {
          fnC(x);
        }
      }
      window.customElements.define(generateTagName(), C);
      new C();
      expect(x).to.equal(3);
      expect(fnA.callCount).to.equal(1);
      expect(fnB.callCount).to.equal(1);
      expect(fnC.callCount).to.equal(1);
      expect(fnA.getCalls()[0].args).to.eql([3]);
      expect(fnB.getCalls()[0].args).to.eql([3]);
      expect(fnC.getCalls()[0].args).to.eql([3]);
    });
  });

  describe("@define", () => {
    test("register base class and subclass as elements", () => {
      const nameBase = generateTagName();
      const nameTest = generateTagName();
      @define(nameBase)
      class Base extends HTMLElement {
        baseFn = spy();
        @prop(number()) accessor foo = 23;
        @reactive() methodBase() {
          this.baseFn();
        }
      }
      @define(nameTest)
      class Test extends Base {
        testFn = spy();
        @prop(string()) accessor bar = "A";
        @reactive() methodTest() {
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
  });
});
