// This example is a simple Todo SPA built with Ornament, uhtml and Signals. It
// demonstrates how Ornament plus some addons (a base class and a custom
// decorator) can deliver a reasonable DX.

import {
  define,
  attr,
  prop,
  bool,
  number,
  json,
  reactive,
  subscribe,
} from "@sirpepe/ornament";
import { signal, computed } from "@preact/signals-core";
import { render, html } from "uhtml";

// Custom base class to provide some common functionality, in this case
// rendering to shadow DOM with uhtml This class could in theory contain even
// more features, use an entirely different rendering library, render to light
// DOM instead of shadow DOM, or do anything else really.
class BaseComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  // Wraps uhtml's render() function to make it available to every subclass
  // without importing extra libraries.
  html(strings, ...values) {
    return html(strings, ...values);
  }

  // Essentially wraps uhtml's render() function. If the class has a `css`
  // property, its contents is added in a style tag next to the actual content.
  render(content) {
    if (this.css) {
      return render(
        this.shadowRoot,
        this.html`${content}<style>${this.css}</style>`,
      );
    }
    return render(this.shadowRoot, content);
  }
}

// This application goes down the SPA rabbit hole and therefore has to deal with
// event delegation in shadow roots. To make this palatable, the following
// decorator (which is just a wrapper around @subscribe) has been cribbed from
// the readme.
const handle = (eventName, selector = "*") =>
  subscribe(
    function () {
      // this works because all shadow roots in this project are open, see base
      // class.
      return this.shadowRoot;
    },
    eventName,
    { predicate: (evt) => evt.target.matches(selector) },
  );

// We need a whole lot of events for this application, so we better build a
// small factory to save on boilerplate!
function createEventClass(name) {
  return class extends Event {
    constructor(args) {
      super(name, { bubbles: true, composed: true });
      Object.assign(this, args); // ¯\_(ツ)_/¯
    }
  };
}

// Everything above this line counts as the "framework" for the application, all
// that follows is state management and the actual component code that builds
// on top of the framework and Ornament's decorators.

// Some signals to store the application state. As far as ornament is concerned,
// this could also be implemented with Event Targets, bot those are way less
// cool these days.
let id = 0;

const filter = signal("all"); // "all" | "done" | "open"

const allItems = signal([
  { id: id++, text: "Check out Ornament", done: true },
  { id: id++, text: "Ditch legacy frameworks", done: false },
  { id: id++, text: "Use the platform", done: false },
]);

const filteredItems = computed(() =>
  allItems.value.filter((item) => {
    if (item.done && filter.value === "open") {
      return false;
    }
    if (!item.done && filter.value === "done") {
      return false;
    }
    return true;
  }),
);

// Events that can lead to state changes. Components dispatch the events, they
// bubble up to the app-
const NewItemEvent = createEventClass("todonew");
const DeleteItemEvent = createEventClass("tododelete");
const DoneItemEvent = createEventClass("tododone");
const FilterChangeEvent = createEventClass("filterchange");

// Input element plus submit button for new todo items
@define("todo-input")
class TodoInput extends BaseComponent {
  // Tracks the current input value. Not reactive because there is no need for
  // this to cause re-rendering (no "controlled inputs")
  #text = "";

  // Toggles whether or not the submit button is enabled. Reactive in order to
  // trigger re-renders on change.
  @prop(bool()) accessor #submittable = false;

  // User typing something
  @handle("input")
  #handleInput(evt) {
    this.#text = evt.target.value;
    this.#submittable = this.#text !== "";
  }

  // User pressing enter
  @handle("keydown", "input")
  #handleEnter(evt) {
    if (evt.keyCode === 13) {
      this.#handleSend();
    }
  }

  // User submitting something via button click... you get the idea.
  @handle("click", "button")
  #handleSend() {
    if (this.#submittable) {
      this.dispatchEvent(new NewItemEvent({ text: this.#text }));
      this.shadowRoot.querySelector("input").value = ""; // ¯\_(ツ)_/¯
    }
  }

  @reactive()
  update() {
    this.render(
      this.html`
        <label>
          New item:
          <input type="text" placeholder="What needs to be done?">
        </label>
        <button ?disabled=${!this.#submittable}>
          Add
        </button>
      `,
    );
  }
}

// A single todo item
@define("todo-item")
class TodoItem extends BaseComponent {
  @attr(number(), { as: "item-id" }) accessor itemId = -1;
  @attr(bool()) accessor done = false;

  get css() {
    return `:host([done]) { text-decoration: line-through }`;
  }

  @handle("change", "input")
  #handleToggle() {
    if (this.itemId !== -1) {
      this.dispatchEvent(new DoneItemEvent({ id: this.itemId }));
    }
  }

  @handle("click", "button")
  #handleDelete() {
    if (this.itemId !== -1) {
      this.dispatchEvent(new DeleteItemEvent({ id: this.itemId }));
    }
  }

  @reactive()
  #update() {
    this.render(
      this.html`
        <input type="checkbox" .checked=${this.done}>
        <slot></slot>
        <button>×</button>
      `,
    );
  }
}

// The actual list of todo items. For some reason eslint does not like the
// template string.
@define("todo-list")
class TodoList extends BaseComponent {
  @attr(json()) accessor items = [];

  get css() {
    return `
:host { display: block; margin: 1em 0 }
ul { list-style: none; margin: 0; padding: 0 }`;
  }

  @reactive()
  #update() {
    this.render(
      /* eslint-disable */
      this.html`<ul>
        ${this.items.map(
          ({ id, text, done }) => this.html`
            <li>
              <todo-item id=${id} item-id=${id} ?done=${done}>${text}</todo-item>
            </li>
          `,
        )}
      </ul>`,
      /* eslint-enable */
    );
  }
}

@define("todo-stats")
class TodoStats extends BaseComponent {
  @attr(json()) accessor items = [];

  @reactive()
  #update() {
    const left =
      this.items.length - this.items.filter((item) => item.done).length;
    const text =
      left === 1
        ? `item of ${this.items.length} left to do`
        : `items of ${this.items.length} left to do`;
    this.render(this.html`<p>${left} ${text}</p>`);
  }
}

@define("todo-filter")
class TodoFilter extends BaseComponent {
  @handle("change", "input")
  #handleChange(evt) {
    this.dispatchEvent(new FilterChangeEvent({ value: evt.target.value }));
  }

  constructor() {
    super();
    this.render(
      this
        .html`<p>Show: <label><input type="radio" name="filter" value="all" .checked=${
        filter.value === "all"
      }> All</label> <label><input type="radio" name="filter" value="open" .checked=${
        filter.value === "open"
      }> Open</label> <label><input type="radio" name="filter" value="done" .checked=${
        filter.value === "done"
      }> Done</label></p>`,
    );
  }
}

// The root UI component that ties all other UI components together. A state
// container can wrap this component and pass the actual data (taken from
// signals in this example) as attributes.
@define("todo-app")
class TodoApp extends BaseComponent {
  // Expressing data as giant JSON strings is a bit silly, so this component
  // takes its data as plain objects in IDL properties, rather than as content
  // attributes.
  @prop(json()) accessor allItems = [];
  @prop(json()) accessor filteredItems = [];

  @reactive()
  #update() {
    this.render(this.html`
      <todo-input></todo-input>
      <todo-list .items=${filteredItems.value}></todo-list>
      <todo-stats .items=${allItems.value}></todo-stats>
      <todo-filter></todo-filter>
    `);
  }
}

// The root component. I call components like this "applets", because they don't
// really behave like the ideal "web component" at all: they are not
// particularly reusable because they talk to the state stores, they don't have
// much in the way of attributes and they only exist to compose a bunch of
// proper reusable web components (and maybe some HTML) into a useful slice of
// the entire application.
@define("todo-applet")
class TodoApplet extends BaseComponent {
  @handle("todonew")
  #handleNew(evt) {
    allItems.value = [...allItems.value, { id: id++, text: evt.text }];
  }

  @handle("tododone")
  #handleDone(evt) {
    allItems.value = allItems.value.map((item) => {
      if (item.id === evt.id) {
        return { ...item, done: !item.done };
      }
      return item;
    });
  }

  @handle("tododelete")
  #handleDelete(evt) {
    allItems.value = allItems.value.filter((item) => {
      if (item.id === evt.id) {
        return false;
      }
      return true;
    });
  }

  @handle("filterchange")
  #handleFilterChange(evt) {
    filter.value = evt.value;
  }

  @subscribe(allItems)
  @subscribe(filteredItems)
  #update() {
    this.render(
      this
        .html`<todo-app .allItems=${allItems.value} .filteredItems=${filteredItems.value}></todo-app>`,
    );
  }
}

// Go!
document.body.append(document.createElement("todo-applet"));
