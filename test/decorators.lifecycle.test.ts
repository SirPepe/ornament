import { expect } from "@esm-bundle/chai";
import { spy } from "sinon";
import {
  attr,
  define,
  prop,
  string,
  connected,
  disconnected,
  adopted,
  formAssociated,
  formDisabled,
  init,
  formReset,
} from "../src/index.js";
import { generateTagName, wait } from "./helpers.js";
const test = it;

describe("Decorators", () => {
  describe("@connected/@disconnected", () => {
    test("methods fire on (dis)connect", async () => {
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

    test("field functions fire on (dis)connect", async () => {
      const connectFn = spy();
      const disconnectFn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @connected() connected = () => connectFn(this);
        @disconnected() disconnected = () => disconnectFn(this);
      }
      const instance = new Test();
      document.body.append(instance);
      instance.remove();
      expect(connectFn.callCount).to.equal(1);
      expect(connectFn.getCalls()[0].args).to.eql([instance]);
      expect(disconnectFn.callCount).to.equal(1);
      expect(disconnectFn.getCalls()[0].args).to.eql([instance]);
    });

    test("fail on non-functions type fields", async () => {
      expect(() => {
        @define(generateTagName())
        class Test extends HTMLElement {
          @connected() connected: any = 42;
        }
        new Test();
      }).to.throw();
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

    test("fire private method on connect with access to private fields when already connected", async () => {
      const connectFn = spy();
      const tagName = generateTagName();
      const instance = document.createElement(tagName);
      document.body.append(instance);
      @define(tagName)
      class Test extends HTMLElement {
        #test = 42;
        @connected() #connected() {
          connectFn(this, this.#test);
        }
      }
      expect(connectFn.callCount).to.equal(1);
      expect(connectFn.getCalls()[0].args).to.eql([instance, 42]);
    });
  });

  describe("@adopted", () => {
    test("fire methods on adoption", async () => {
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

    test("fire field functions on adoption", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @adopted() adopted = () => fn(this);
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
    test("fire methods on form association", async () => {
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

    test("fire field functions on form association", async () => {
      const decoratedSpy = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        static formAssociated = true;
        @formAssociated() associated = (owner: HTMLFormElement | null) =>
          decoratedSpy(this, owner);
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
    });
  });

  describe("@formReset", () => {
    test("fire methods on form reset", async () => {
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

    test("fire field functions on form reset", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        static formAssociated = true;
        @formReset() reset = () => fn(this);
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
    test("fire methods on fieldset disable", async () => {
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

    test("fire class fields on fieldset disable", async () => {
      const decoratedSpy = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        static formAssociated = true;
        @formDisabled() disable = (state: boolean) => decoratedSpy(this, state);
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
    });
  });

  // Don't know how to properly test this one ¯\_(ツ)_/¯
  describe.skip("@formStateRestore", () => undefined);

  describe("@init", () => {
    test("run method on init", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        @init() test() {
          fn(this.x);
        }
      }
      const el = new Test();
      el.x = "B";
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql(["A"]);
    });

    test("run field function on init", async () => {
      const fn = spy();
      @define(generateTagName())
      class Test extends HTMLElement {
        @prop(string()) accessor x = "A";
        @init() test = () => fn(this.x);
      }
      const el = new Test();
      el.x = "B";
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql(["A"]);
    });

    test("fail on non-functions type fields", async () => {
      expect(() => {
        @define(generateTagName())
        class Test extends HTMLElement {
          @init() test: any = 42;
        }
        new Test();
      }).to.throw();
    });

    test("Attribute values are available when decorated methods run", async () => {
      const fn = spy();
      const tagName = generateTagName();
      @define(tagName)
      class Test extends HTMLElement {
        @attr(string()) accessor attr = "";
        @init() test() {
          fn(this.attr);
        }
      }
      const fixture = document.createElement("div");
      document.body.append(fixture);
      fixture.innerHTML = `<${tagName} attr="aaa"></${tagName}>`;
      expect(fn.callCount).to.equal(1);
      expect(fn.getCalls()[0].args).to.eql(["aaa"]);
    });
  });
});
