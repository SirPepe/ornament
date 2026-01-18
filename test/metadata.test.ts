import { expect } from "@esm-bundle/chai";
import {
  define,
  attr,
  string,
  getTagName,
  listAttributes,
  getAttribute,
  prop,
  number,
} from "../src/index.js";
import { generateTagName } from "./helpers.js";
const test = it;

describe("Metadata", () => {
  describe("Tag name", () => {
    test("Report the tag name", () => {
      const tagName = generateTagName();
      @define(tagName)
      class Test extends HTMLElement {}
      expect(getTagName(Test)).to.equal(tagName);
      expect(getTagName(new Test())).to.equal(tagName);
      expect(getTagName({})).to.equal(null);
      expect(getTagName(42)).to.equal(null);
    });
  });

  describe("Attributes", () => {
    test("Report attribute metadata", () => {
      const tagName = generateTagName();
      @define(tagName)
      class Test extends HTMLElement {
        @attr(string()) accessor foo = "";
        @attr(number({ min: 0 }), { as: "asdf" }) accessor bar = 0;
        @prop(string()) accessor baz = "";
      }
      expect(listAttributes(Test)).to.eql(["foo", "asdf"]);
      expect(listAttributes(new Test())).to.eql(["foo", "asdf"]);
      const fooAttr = getAttribute(Test, "foo");
      expect(fooAttr?.prop).to.equal("foo");
      expect(typeof fooAttr?.transformer).to.equal("object"); // string transform
      const asdfAttr = getAttribute(Test, "asdf");
      expect(asdfAttr?.prop).to.equal("bar");
      expect(typeof asdfAttr?.transformer).to.equal("object"); // number transform
      expect(asdfAttr?.transformer.parse("-1")).to.equal(0); // clamped to valid value
      expect(() => {
        asdfAttr?.transformer.validate(-6, true);
      }).to.throw();
      expect(getAttribute(Test, "bar")).to.equal(null);
      expect(getAttribute(Test, "baz")).to.equal(null);
    });
  });

  describe("General", () => {
    test("Inheritance", () => {
      @define(generateTagName())
      class A extends HTMLElement {
        @attr(string()) accessor a = "";
      }
      @define(generateTagName())
      class B extends A {
        @attr(string()) accessor b = "";
      }
      // expect(getAttribute(A, "a")).to.not.equal(null);
      // expect(getAttribute(A, "b")).to.equal(null);
      expect(getAttribute(B, "a")).to.not.equal(null);
      // expect(getAttribute(B, "b")).to.not.equal(null);
    });
  });

  test("No cross-contamination", () => {
    @define(generateTagName())
    class Base extends HTMLElement {}
    @define(generateTagName())
    class A extends Base {
      @attr(string()) accessor a = "";
    }
    @define(generateTagName())
    class B extends Base {
      @attr(string()) accessor b = "";
    }
    expect(getAttribute(A, "a")).to.not.equal(null);
    expect(getAttribute(A, "b")).to.equal(null);
    expect(getAttribute(B, "a")).to.equal(null);
    expect(getAttribute(B, "b")).to.not.equal(null);
  });
});
