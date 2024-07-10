import { expect } from "@esm-bundle/chai";
import { spy } from "sinon";
import { define, subscribe, trigger } from "../src/index.js";
import { generateTagName, wait } from "./helpers.js";
import { signal } from "@preact/signals-core";
const test = it;

describe("Decorators", () => {
  describe("@subscribe", () => {
    describe("@subscribe on signals", () => {
      test("subscribe a method to a signal", async () => {
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

      test("subscribe a method to a signal with a predicate", async () => {
        const fn = spy();
        const counter = signal(0);
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(counter, { predicate: (_, v) => v % 2 === 0 })
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

      test("subscribe a field function to a signal", async () => {
        const fn = spy();
        const counter = signal(0);
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(counter) test = () => fn(this, counter.value);
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

      test("custom subscribe and unsubscribe triggers", async () => {
        const fn = spy();
        const counter = signal(0);
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(counter, {
            activateOn: ["connected"],
            deactivateOn: ["disconnected"],
          })
          test() {
            fn(this, counter.value);
          }
        }
        // Init: no effect, subscription ony activates on connect
        const instance = new Test();
        expect(fn.callCount).to.equal(0);
        // First update: no effect, subscription ony activates on connect
        counter.value = 1;
        expect(fn.callCount).to.equal(0);
        // Connect: activates subscription
        document.body.append(instance);
        expect(fn.callCount).to.equal(1);
        expect(fn.getCalls()[0].args).to.eql([instance, 1]);
        counter.value = 2;
        expect(fn.callCount).to.equal(2);
        expect(fn.getCalls()[1].args).to.eql([instance, 2]);
        // Synthetic second connect event should not have any effect
        trigger(instance, "connected");
        expect(fn.callCount).to.equal(2);
        // Two connect events should still only result in one subscription
        counter.value = 3;
        expect(fn.callCount).to.equal(3);
        expect(fn.getCalls()[2].args).to.eql([instance, 3]);
        // Disconnecting unsubscribes
        instance.remove();
        counter.value = 4;
        expect(fn.callCount).to.equal(3);
        // Synthetic second disconnect event should not have any effect
        trigger(instance, "disconnected");
      });
    });

    describe("@subscribe on event targets", () => {
      test("subscribe a method to an event target", async () => {
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

      test("subscribe a field function to an event target", async () => {
        const fn = spy();
        const target = new EventTarget();
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(target, "foo") test = (event: Event) =>
            fn(this, event, event.target);
        }
        const instance = new Test();
        const event = new Event("foo");
        target.dispatchEvent(event);
        expect(fn.callCount).to.equal(1);
        expect(fn.getCalls()[0].args).to.eql([instance, event, target]);
      });

      test("subscribe a method to multiple events on an event target", async () => {
        const fn = spy();
        const target = new EventTarget();
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(target, "foo bar\n  baz")
          test(event: Event) {
            fn(this, event, event.target);
          }
        }
        const instance = new Test();
        const event1 = new Event("foo");
        const event2 = new Event("bar");
        const event3 = new Event("baz");
        target.dispatchEvent(event1);
        target.dispatchEvent(event2);
        target.dispatchEvent(event3);
        expect(fn.callCount).to.equal(3);
        expect(fn.getCalls()[0].args).to.eql([instance, event1, target]);
        expect(fn.getCalls()[1].args).to.eql([instance, event2, target]);
        expect(fn.getCalls()[2].args).to.eql([instance, event3, target]);
      });

      test("subscribe a method to an event target and access private fields", async () => {
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

      test("custom subscribe and unsubscribe triggers", async () => {
        const fn = spy();
        const target = new EventTarget();
        const triggerEvent = () => {
          const event = new Event("foo");
          target.dispatchEvent(event);
          return event;
        };
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(target, "foo", {
            activateOn: ["connected"],
            deactivateOn: ["disconnected"],
          })
          test(evt: any) {
            fn(this, evt);
          }
        }
        // Init: no effect, subscription ony activates on connect
        const instance = new Test();
        // First event: no effect, subscription ony activates on connect
        triggerEvent();
        expect(fn.callCount).to.equal(0);
        // Connect: activates subscription
        document.body.append(instance);
        const a = triggerEvent();
        expect(fn.callCount).to.equal(1);
        expect(fn.getCalls()[0].args).to.eql([instance, a]);
        // Synthetic second connect event should not have any effect. Two
        // connect events should still only result in one subscription
        trigger(instance, "connected");
        const b = triggerEvent();
        expect(fn.callCount).to.equal(2);
        expect(fn.getCalls()[1].args).to.eql([instance, b]);
        // Disconnecting unsubscribes
        instance.remove();
        triggerEvent();
        expect(fn.callCount).to.equal(2); // <- no change
        // Synthetic second disconnect event should not have any effect
        trigger(instance, "disconnected");
      });

      test("subscribe a method to an event target factory", async () => {
        const fn = spy();
        const target = new EventTarget();
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe((element) => {
            // can't check if this is actually "instance", because that's not
            // initialized at this point. But come on, what else could it be...
            expect(element).to.be.instanceOf(Test);
            return target;
          }, "foo")
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

      const FACTORY_FACTORIES = {
        function: (x: EventTarget) => () => x,
        promise: (x: EventTarget) => Promise.resolve(x),
        "promise-returning function": (x: EventTarget) => () =>
          Promise.resolve(x),
        "promise returning a function": (x: EventTarget) =>
          Promise.resolve(() => x),
        "promise returning a function returning a promise": (x: EventTarget) =>
          Promise.resolve(() => Promise.resolve(x)),
      };

      for (const [name, factoryFactory] of Object.entries(FACTORY_FACTORIES)) {
        test(`subscribe a method to an event target delivered by a factory: ${name}`, async () => {
          const fn = spy();
          const target = new EventTarget();
          @define(generateTagName())
          class Test extends HTMLElement {
            @subscribe(factoryFactory(target), "foo")
            test(event: Event) {
              fn(this, event, event.target);
            }
          }
          const instance = new Test();
          await wait(0);
          const event = new Event("foo");
          target.dispatchEvent(event);
          expect(fn.callCount).to.equal(1);
          expect(fn.getCalls()[0].args).to.eql([instance, event, target]);
        });
      }

      test("subscribe a method to an element", async () => {
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

      test("subscribe a method in capture mode", async () => {
        const fn = spy();
        const parent = document.createElement("div");
        const target = document.createElement("div");
        parent.append(target);
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(parent, "test", { capture: true })
          test(event: Event) {
            fn(this, event, event.target);
          }
        }
        const instance = new Test();
        const event = new Event("test", { bubbles: false });
        target.dispatchEvent(event);
        expect(fn.callCount).to.equal(1);
        expect(fn.getCalls()[0].args).to.eql([instance, event, target]);
      });

      test("subscribe a method to events on the shadow dom", async () => {
        const fn = spy();
        const target = document.createElement("div");
        @define(generateTagName())
        class Test extends HTMLElement {
          root = this.attachShadow({ mode: "open" });
          constructor() {
            super();
            this.root.append(target);
          }
          @subscribe((instance: Test) => instance.root, "click")
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

      test("subscribe a method to events on shadow dom from the constructor", async () => {
        const fn = spy();
        const target = document.createElement("div");
        @define(generateTagName())
        class Test extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: "open" }).append(target);
          }
          @subscribe((instance: Test) => instance.shadowRoot as any, "click")
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

      test("subscribe a method with a predicate", async () => {
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
          @subscribe(target, "test", {
            predicate: (_, evt: TestEvent) => evt.value,
          })
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

      test("subscribe a field function with a predicate", async () => {
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
          @subscribe(target, "test", {
            predicate: (_, evt: TestEvent) => evt.value,
          })
          test = (event: TestEvent) => fn(this, event.value);
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

      test("require the correct event types", async () => {
        const t1 = document.createElement("div");
        class Test extends HTMLElement {
          @subscribe<Test, HTMLElement, "foo", HTMLElementEventMap>(t1, "foo")
          test1(evt: Event) {}
          @subscribe<Test, HTMLElement, "click", HTMLElementEventMap>(
            t1,
            "click",
          )
          test2(evt: MouseEvent) {}
          @subscribe<Test, HTMLElement, "focus", HTMLElementEventMap>(
            t1,
            "focus",
          )
          test3(evt: FocusEvent) {}
          @subscribe<Test, HTMLElement, "focus click", HTMLElementEventMap>(
            t1,
            "focus click",
          )
          test4(evt: MouseEvent | FocusEvent) {}
          @subscribe<Test, HTMLElement, "focus click", HTMLElementEventMap>(
            t1,
            // @ts-expect-error wrong event type
            "foo",
          )
          test5(evt: MouseEvent) {}
          @subscribe<Test, HTMLElement, "focus click", HTMLElementEventMap>(
            t1,
            // @ts-expect-error wrong event type
            "focus",
          )
          test6(evt: MouseEvent) {}
          // @ts-expect-error wrong event type
          @subscribe<Test, HTMLElement, "focus click", HTMLElementEventMap>(
            t1,
            "focus click",
          )
          test7(evt: DragEvent) {}
          // Accept anything in the absence of generics
          @subscribe(t1, "whatever") test8(evt: DragEvent) {} // Yolo
        }
      });

      test("reject on static fields", async () => {
        expect(() => {
          class Test extends HTMLElement {
            // @ts-expect-error for testing runtime checks
            @subscribe(new EventTarget(), "foo") static test() {
              return;
            }
          }
        }).to.throw(TypeError);
      });
    });
  });
});
