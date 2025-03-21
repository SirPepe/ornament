import { expect } from "@esm-bundle/chai";
import { spy } from "sinon";
import { define, reactive, subscribe, trigger } from "../src/index.js";
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
          test(value: number) {
            fn(this, value);
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
        const predFn = spy();
        const counter = signal(0);
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(counter, {
            predicate(value, instance) {
              predFn(this, value, instance);
              return value % 2 === 0;
            },
          })
          test(value: number) {
            fn(this, value);
          }
        }
        const instance = new Test();
        counter.value = 1;
        counter.value = 2;
        counter.value = 3;
        expect(fn.callCount).to.equal(2);
        expect(fn.getCalls()[0].args).to.eql([instance, 0]);
        expect(fn.getCalls()[1].args).to.eql([instance, 2]);
        expect(predFn.callCount).to.equal(4);
        expect(predFn.getCalls()[0].args).to.eql([instance, 0, instance]);
        expect(predFn.getCalls()[1].args).to.eql([instance, 1, instance]);
        expect(predFn.getCalls()[2].args).to.eql([instance, 2, instance]);
        expect(predFn.getCalls()[3].args).to.eql([instance, 3, instance]);
      });

      test("subscribe a method to a signal with a transform", async () => {
        const fn = spy();
        const transformFn = spy();
        const counter = signal(0);
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(counter, {
            transform(value, instance) {
              transformFn(this, value, instance);
              return String(value);
            },
          })
          test(value: string) {
            fn(this, value);
          }
        }
        const instance = new Test();
        counter.value = 1;
        counter.value = 2;
        counter.value = 3;
        expect(fn.callCount).to.equal(4);
        expect(fn.getCalls()[0].args).to.eql([instance, "0"]);
        expect(fn.getCalls()[1].args).to.eql([instance, "1"]);
        expect(fn.getCalls()[2].args).to.eql([instance, "2"]);
        expect(fn.getCalls()[3].args).to.eql([instance, "3"]);
        expect(transformFn.callCount).to.equal(4);
        expect(transformFn.getCalls()[0].args).to.eql([instance, 0, instance]);
        expect(transformFn.getCalls()[1].args).to.eql([instance, 1, instance]);
        expect(transformFn.getCalls()[2].args).to.eql([instance, 2, instance]);
        expect(transformFn.getCalls()[3].args).to.eql([instance, 3, instance]);
      });

      test("subscribe a method to a signal with a predicate and a transform", async () => {
        const fn = spy();
        const counter = signal(0);
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(counter, {
            predicate: (value) => value % 2 === 0,
            transform: (value) => String(value),
          })
          test(value: string) {
            fn(this, value);
          }
        }
        const instance = new Test();
        counter.value = 1;
        counter.value = 2;
        counter.value = 3;
        expect(fn.callCount).to.equal(2);
        expect(fn.getCalls()[0].args).to.eql([instance, "0"]);
        expect(fn.getCalls()[1].args).to.eql([instance, "2"]);
      });

      test("subscribe a field function to a signal", async () => {
        const fn = spy();
        const counter = signal(0);
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(counter) test = (value: number) => fn(this, value);
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

      test("subscribe an accessor to a signal", async () => {
        const fn = spy();
        const counter = signal(0);
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(counter) accessor value: number = 0;
          @reactive()
          react() {
            fn(this, this.value);
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

      test("subscribe an accessor to a signal with a transform", async () => {
        const fn = spy();
        const counter = signal(0);
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(counter, { transform: (x) => String(x) })
          accessor value: string = "0";
          @reactive()
          react() {
            fn(this, this.value);
          }
        }
        const instance = new Test();
        counter.value = 1;
        counter.value = 2;
        counter.value = 3;
        expect(fn.callCount).to.equal(4);
        expect(fn.getCalls()[0].args).to.eql([instance, "0"]);
        expect(fn.getCalls()[1].args).to.eql([instance, "1"]);
        expect(fn.getCalls()[2].args).to.eql([instance, "2"]);
        expect(fn.getCalls()[3].args).to.eql([instance, "3"]);
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
          test(value: number) {
            fn(this, value);
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

      test("require the correct method types", async () => {
        const counter = signal(0);
        class Test extends HTMLElement {
          // @ts-expect-error wrong parameter type
          @subscribe(counter)
          test0(value: string) {}
          // @ts-expect-error wrong transformer result type
          @subscribe(counter, { transform: (_, x) => Boolean(x) })
          test1(value: string) {}
        }
      });

      test("require the correct field function types", async () => {
        const counter = signal(0);
        class Test extends HTMLElement {
          // @ts-expect-error wrong parameter type
          @subscribe(counter)
          test0 = (value: string) => {};
          // @ts-expect-error wrong transformer result type
          @subscribe(counter, { transform: (_, x) => Boolean(x) })
          test1 = (value: string) => {};
        }
      });

      test("require the correct signal types", async () => {
        const counter = signal(0);
        class Test extends HTMLElement {
          // @ts-expect-error wrong parameter type
          @subscribe(counter)
          accessor test0: string = "";
          // @ts-expect-error wrong transformer result type
          @subscribe(counter, { transform: (_, x) => Boolean(x) })
          accessor test1: string = "";
        }
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

      test("subscribe a method to an event target with a transform", async () => {
        const fn = spy();
        const transformFn = spy();
        const target = new EventTarget();
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(target, "foo", {
            transform(evt, instance) {
              transformFn(this, evt, instance);
              return evt.bubbles;
            },
          })
          test(data: boolean) {
            fn(this, data);
          }
        }
        const instance = new Test();
        const event = new Event("foo");
        target.dispatchEvent(event);
        expect(fn.callCount).to.equal(1);
        expect(fn.getCalls()[0].args).to.eql([instance, false]);
        expect(transformFn.callCount).to.equal(1);
        expect(transformFn.getCalls()[0].args).to.eql([
          instance,
          event,
          instance,
        ]);
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

      test("subscribe a field function to an event target with a transform", async () => {
        const fn = spy();
        const target = new EventTarget();
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(target, "foo", { transform: (evt) => evt.type })
          test = (name: string) => fn(this, name);
        }
        const instance = new Test();
        const event = new Event("foo");
        target.dispatchEvent(event);
        expect(fn.callCount).to.equal(1);
        expect(fn.getCalls()[0].args).to.eql([instance, "foo"]);
      });

      test("subscribe an accessor to an event target", async () => {
        const fn = spy();
        const target = new EventTarget();
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(target, "foo") accessor test: any;
          @reactive() react = () => fn(this, this.test);
        }
        const instance = new Test();
        const event = new Event("foo");
        target.dispatchEvent(event);
        expect(fn.callCount).to.equal(1);
        expect(fn.getCalls()[0].args).to.eql([instance, event]);
      });

      test("subscribe an accessor to an event target with a transform", async () => {
        const fn = spy();
        const target = new EventTarget();
        @define(generateTagName())
        class Test extends HTMLElement {
          @subscribe(target, "foo", { transform: (evt) => evt.target })
          accessor test: any;
          @reactive() react = () => fn(this, this.test);
        }
        const instance = new Test();
        const event = new Event("foo");
        target.dispatchEvent(event);
        expect(fn.callCount).to.equal(1);
        expect(fn.getCalls()[0].args).to.eql([instance, target]);
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
        const predFn = spy();
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
            predicate(evt: TestEvent, instance) {
              predFn(this, evt, instance);
              return evt.value;
            },
          })
          test(event: TestEvent) {
            fn(this, event.value);
          }
        }
        const instance = new Test();
        const a = new TestEvent(true);
        target.dispatchEvent(a);
        const b = new TestEvent(false);
        target.dispatchEvent(b);
        const c = new TestEvent(true);
        target.dispatchEvent(c);
        const d = new TestEvent(false);
        target.dispatchEvent(d);
        expect(fn.callCount).to.equal(2);
        expect(fn.getCalls()[0].args).to.eql([instance, true]);
        expect(fn.getCalls()[1].args).to.eql([instance, true]);
        expect(predFn.callCount).to.equal(4);
        expect(predFn.getCalls()[0].args).to.eql([instance, a, instance]);
        expect(predFn.getCalls()[1].args).to.eql([instance, b, instance]);
        expect(predFn.getCalls()[2].args).to.eql([instance, c, instance]);
        expect(predFn.getCalls()[3].args).to.eql([instance, d, instance]);
      });

      test("subscribe a method with a transform", async () => {
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
            transform: (evt: TestEvent) => evt.value,
          })
          test(value: boolean) {
            fn(this, value);
          }
        }
        const instance = new Test();
        target.dispatchEvent(new TestEvent(true));
        target.dispatchEvent(new TestEvent(false));
        target.dispatchEvent(new TestEvent(true));
        target.dispatchEvent(new TestEvent(false));
        expect(fn.callCount).to.equal(4);
        expect(fn.getCalls()[0].args).to.eql([instance, true]);
        expect(fn.getCalls()[1].args).to.eql([instance, false]);
        expect(fn.getCalls()[2].args).to.eql([instance, true]);
        expect(fn.getCalls()[3].args).to.eql([instance, false]);
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
            predicate: (evt: TestEvent) => evt.value,
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

      test("require the correct method types", async () => {
        const t = document.createElement("div");
        class Test extends HTMLElement {
          // Most general case: some sort of unknown-to-TS event
          @subscribe(t, "foo")
          test0a(evt: Event) {}

          // Unknown event, method claims to know what's going on
          @subscribe(t, "foo")
          test0b(evt: MouseEvent) {}

          // @ts-expect-error not a subtype of Event at all
          @subscribe(t, "foo")
          test0c(notAnEvent: number) {}

          // With transform
          @subscribe(t, "click", {
            transform: (evt: MouseEvent) => evt.bubbles,
          })
          test1a(value: boolean) {}

          // @ts-expect-error with transform, wrong method signature
          @subscribe(t, "click", {
            transform: (evt: MouseEvent) => evt.bubbles,
          })
          test1b(value: string) {}
        }
      });

      test("abstraction specific to DOM events", async () => {
        // Create a variant of subscribe specific to DOM events
        const listen = <
          T extends HTMLElement,
          K extends keyof HTMLElementEventMap,
        >(
          source: HTMLElement,
          ...eventNames: K[]
        ) =>
          subscribe<T, HTMLElement, HTMLElementEventMap[K]>(
            source,
            eventNames.join(" "),
          );

        const eventSource = document.createElement("div");
        class Test extends HTMLElement {
          // Works: "click" is a MouseEvent
          @listen(eventSource, "click")
          handleClick(evt: MouseEvent) {}

          // Works: all event types listed by name are covered in the union
          @listen(eventSource, "transitionstart", "animationstart")
          handleAnimationStart(evt: AnimationEvent | TransitionEvent) {}

          // @ts-expect-error  "focus" is not a mouse event
          @listen(eventSource, "focus")
          handleFocus(evt: MouseEvent) {}

          // @ts-expect-error  type "TransitionEvent" is not covered
          @listen(eventSource, "transitionend", "animationend")
          handleAnimationEnd(evt: AnimationEvent) {}

          // @ts-expect-error  "asdf" is not a DOM event
          @listen(eventSource, "asdf")
          handleAsdf(evt: Event) {}
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
