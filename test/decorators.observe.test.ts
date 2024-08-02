import { expect } from "@esm-bundle/chai";
import { spy } from "sinon";
import { define, observe } from "../src/index.js";
import { generateTagName, wait } from "./helpers.js";
const test = it;

// Observers are async and test may be quite slow
const TIMEOUT = 250;

describe("Decorators", () => {
  describe("@observe", () => {
    describe("MutationObserver", () => {
      test("Observe mutations", async () => {
        const fn = spy();
        @define(generateTagName())
        class Test extends HTMLElement {
          @observe(MutationObserver, { childList: true })
          test(records: MutationRecord[], observer: MutationObserver) {
            fn(
              this,
              records.map((record) => record.type),
              observer instanceof MutationObserver,
            );
          }
        }
        const instance = new Test();
        instance.innerText = `Test`;
        await wait(TIMEOUT); // Mutation observers are async
        expect(fn.callCount).to.equal(1);
        expect(fn.getCalls()[0].args).to.eql([instance, ["childList"], true]);
      });

      test("Observe mutations when connected", async () => {
        const fn = spy();
        @define(generateTagName())
        class Test extends HTMLElement {
          @observe(MutationObserver, { childList: true })
          test(records: MutationRecord[], observer: MutationObserver) {
            fn(
              this,
              records.map((record) => record.type),
              observer instanceof MutationObserver,
            );
          }
        }
        const instance = new Test();
        document.body.append(instance);
        instance.innerText = `Test`;
        await wait(TIMEOUT); // Mutation observers are async
        expect(fn.callCount).to.equal(1);
        expect(fn.getCalls()[0].args).to.eql([instance, ["childList"], true]);
      });

      test("Start/Stop observing based on connected state", async () => {
        const fn = spy();
        @define(generateTagName())
        class Test extends HTMLElement {
          @observe(MutationObserver, {
            childList: true,
            activateOn: ["connected"],
            deactivateOn: ["disconnected"],
          })
          test(records: MutationRecord[], observer: MutationObserver) {
            fn(
              this,
              records.map((record) => record.type),
              observer instanceof MutationObserver,
            );
          }
        }
        const instance = new Test();
        instance.innerText = `Test 1`;
        await wait(TIMEOUT); // Mutation observers are async
        expect(fn.callCount).to.equal(0); // Nothing happens, not connected
        document.body.append(instance); // connect
        await wait(TIMEOUT); // Mutation observers are async
        expect(fn.callCount).to.equal(0); // No changes since connecting
        instance.innerText = `Test 2`;
        await wait(TIMEOUT); // Mutation observers are async
        expect(fn.callCount).to.equal(1); // collect records when connected
        expect(fn.getCalls()[0].args).to.eql([instance, ["childList"], true]);
        instance.remove(); // disconnect
        instance.innerText = `Test 3`;
        await wait(TIMEOUT); // Mutation observers are async
        expect(fn.callCount).to.equal(1); // No new changes
      });
    });

    describe("IntersectionObserver", () => {
      test("Observe intersections", async () => {
        const fn = spy();
        @define(generateTagName())
        class Test extends HTMLElement {
          @observe(IntersectionObserver)
          test(
            records: IntersectionObserverEntry[],
            observer: IntersectionObserver,
          ) {
            fn(
              this,
              records.map((record) => record.isIntersecting),
              observer instanceof IntersectionObserver,
            );
          }
        }
        const instance = new Test();
        await wait(TIMEOUT); // Intersection observers are async
        expect(fn.callCount).to.equal(1);
        expect(fn.getCalls()[0].args).to.eql([instance, [false], true]);
      });
    });

    describe("ResizeObserver", () => {
      test("Observe resizes", async () => {
        const fn = spy();
        @define(generateTagName())
        class Test extends HTMLElement {
          @observe(ResizeObserver, { box: "border-box" })
          test(records: ResizeObserverEntry[], observer: ResizeObserver) {
            fn(
              this,
              records.map((record) => record.borderBoxSize),
              observer instanceof ResizeObserver,
            );
          }
        }
        const instance = new Test();
        await wait(TIMEOUT); // Resize observers are async
        expect(fn.callCount).to.equal(1);
        const [self, records, typeCheck] = fn.getCalls()[0].args;
        expect(self).to.equal(instance);
        expect(typeCheck).to.equal(true);
        expect(records[0][0].inlineSize).to.eql(0);
      });
    });
  });
});
