import { expect } from "@esm-bundle/chai";
import { spy } from "sinon";
import { listen, trigger, define } from "../src/index.js";
import { generateTagName } from "./helpers.js";
const test = it;

describe("Event bus", () => {
  test("listen()", () => {
    const connectFn = spy();
    const disconnectFn = spy();
    @define(generateTagName())
    class Test extends HTMLElement {}
    const instance = new Test();
    listen(instance, "connected", connectFn);
    listen(instance, "disconnected", disconnectFn);
    document.body.append(instance);
    instance.remove();
    expect(connectFn.callCount).to.equal(1);
    expect(disconnectFn.callCount).to.equal(1);
  });

  test("trigger()", () => {
    const connectFn = spy();
    @define(generateTagName())
    class Test extends HTMLElement {}
    const instance = new Test();
    listen(instance, "connected", connectFn);
    trigger(instance, "connected");
    expect(connectFn.callCount).to.equal(1);
  });
});
