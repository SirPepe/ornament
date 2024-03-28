import { define, attr, number, reactive, connected } from "@sirpepe/ornament";
import { Fragment, h, render } from "preact";

@define("click-counter")
class ClickCounter extends HTMLElement {
  #shadow = this.attachShadow({ mode: "closed" });

  @attr(number({ min: 0 }), { reflective: false }) accessor up = 0;
  @attr(number({ min: 0 }), { reflective: false }) accessor down = 0;

  @connected()
  @reactive()
  render() {
    render(
      <>
        <button onClick={() => this.up++}>+1</button>
        Total: <b>{this.up + this.down}</b>
        <button onClick={() => this.down--}>-1</button>
      </>,
      this.#shadow,
    );
  }
}
