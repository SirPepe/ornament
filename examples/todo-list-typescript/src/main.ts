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
  connected,
  debounce,
  subscribe,
} from "@sirpepe/ornament";
import { signal, computed } from "@preact/signals-core";
import { render, html } from "uhtml";

// Custom rendering decorator composed from @reactive, @connected and @debounce:
// - reacts to attribute updates (when the component is connected)
// - and runs its target once per frame
// - and also when the component connects
const reRender =
  <T extends HTMLElement, V extends (this: T) => any>() =>
  (target: V, context: ClassMethodDecoratorContext<T, V>) =>
    reactive<T>({ predicate: ({ isConnected }) => isConnected })(
      connected<T>()(
        debounce<T, V>({ fn: debounce.raf() })(target, context),
        context,
      ),
      context,
    );

function fail(): never {
  throw new Error("This should never happen");
}

// For extra fun, let's make the shadow roots in the components of this example
// private and closed. But we can't use private class fields, because we do need
// to access the shadow roots in decorators... so let's go the weak map route!
const shadowRoots = new WeakMap<HTMLElement, ShadowRoot>();

// Custom base class to provide some common functionality, in this case
// rendering to shadow DOM with uhtml. Apart from type annotations, this is the
// same as the base class in the plain JS example.
class BaseComponent extends HTMLElement {
  constructor() {
    super();
    shadowRoots.set(this, this.attachShadow({ mode: "closed" }));
  }

  // Wraps uhtml's render() function to make it available to every subclass
  // without importing extra libraries.
  html(...args: Parameters<typeof html>): ReturnType<typeof html> {
    return html(...args);
  }

  // Essentially wraps uhtml's render() function. If the class has a `css`
  // property, its contents is added in a style tag next to the actual content.
  render(content: any) {
    const root = shadowRoots.get(this) ?? fail();
    if ("css" in this) {
      return render(root, this.html`${content}<style>${this.css}</style>`);
    }
    return render(root, content);
  }
}

// App-specific events that can lead to state changes. They will all have to
// bubble and be composed.

class NewItemEvent extends Event {
  readonly text: string;
  constructor(text: string) {
    super("todonew", { bubbles: true, composed: true });
    this.text = text;
  }
}

class DeleteItemEvent extends Event {
  readonly id: number;
  constructor(id: number) {
    super("tododelete", { bubbles: true, composed: true });
    this.id = id;
  }
}

class DoneItemEvent extends Event {
  readonly id: number;
  constructor(id: number) {
    super("tododone", { bubbles: true, composed: true });
    this.id = id;
  }
}

class FilterChangeEvent extends Event {
  readonly value: Filter;
  constructor(value: Filter) {
    super("filterchange", { bubbles: true, composed: true });
    this.value = value;
  }
}

// All DOM events that can happen in this app
type EventNameMap = HTMLElementEventMap & {
  todonew: NewItemEvent;
  tododelete: DeleteItemEvent;
  tododone: DoneItemEvent;
  filterchange: FilterChangeEvent;
};

// This application goes down the SPA rabbit hole and therefore has to deal with
// event delegation in shadow roots. To make this palatable, the following
// decorator (which is just a wrapper around @subscribe) has been adapted from
// the readme.
const capture = <T extends HTMLElement, K extends keyof EventNameMap>(
  eventName: K,
  selector = "*",
) =>
  subscribe<T, ShadowRoot, EventNameMap[K]>(
    (el: T) => shadowRoots.get(el) ?? fail(),
    eventName,
    {
      predicate: (_: unknown, evt: EventNameMap[K]) =>
        evt.target instanceof HTMLElement && evt.target.matches(selector),
    },
  );

// Everything above this line counts as the "framework" for the application, all
// that follows is state management and the actual component code that builds
// on top of the framework and Ornament's decorators.

type Item = {
  id: number;
  text: string;
  done: boolean;
};

type Filter = "all" | "done" | "open";

// Some signals to store the application state. As far as ornament is concerned,
// this could also be implemented with Event Targets, bot those are way less
// cool these days.
let id = 0;

const filter = signal<Filter>("all");

const allItems = signal<Item[]>([
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

// Input element plus submit button for new todo items. This class does not
// actually create a proper new form element, but just wraps one and then throws
// events around.
@define("todo-input")
class TodoInput extends BaseComponent {
  // Keeps a reference to the text input using react-style refs
  #input: { current: null | HTMLInputElement } = { current: null };

  // Toggles whether or not the submit button is enabled. Reactive in order to
  // trigger re-renders on change.
  @prop(bool()) accessor #submittable = false;

  // User typing something
  @capture("input", "input")
  #handleInput() {
    if (this.#input.current) {
      this.#submittable = this.#input.current.value !== "";
    }
  }

  // User pressing enter
  @capture("keydown", "input")
  #handleEnter(evt: KeyboardEvent) {
    if (evt.code === "Enter") {
      this.#handleSend();
    }
  }

  // User submitting something via button click
  @capture("click", "button")
  #handleSend() {
    if (this.#submittable && this.#input.current) {
      this.dispatchEvent(new NewItemEvent(this.#input.current.value));
      this.#input.current.value = "";
    }
  }

  @reRender()
  update() {
    this.render(
      this.html`
        <label>
          New item:
          <input
          type="text"
            ref=${this.#input}
            placeholder="What needs to be done?">
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

  @capture("change", "input")
  #handleToggle() {
    if (this.itemId !== -1) {
      this.dispatchEvent(new DoneItemEvent(this.itemId));
    }
  }

  @capture("click", "button")
  #handleDelete() {
    if (this.itemId !== -1) {
      this.dispatchEvent(new DeleteItemEvent(this.itemId));
    }
  }

  @reRender()
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

  @reRender()
  #update() {
    this.render(
      this.html`<ul>
        ${this.items.map(
          ({ id, text, done }) => this.html`
            <li>
              <todo-item id=${id} item-id=${id} ?done=${done}>${text}</todo-item>
            </li>
          `,
        )}
      </ul>`,
    );
  }
}

@define("todo-stats")
class TodoStats extends BaseComponent {
  @attr(json()) accessor items: Item[] = [];

  @reRender()
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
  @capture("change", "input")
  #handleChange(evt: Event) {
    if (
      evt.target instanceof HTMLInputElement &&
      (evt.target.value === "all" ||
        evt.target.value === "done" ||
        evt.target.value === "open")
    ) {
      this.dispatchEvent(new FilterChangeEvent(evt.target.value));
    }
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
  @prop(json()) accessor allItems: Item[] = [];
  @prop(json()) accessor filteredItems: Item[] = [];

  @reRender()
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
  @capture("todonew")
  #handleNew(evt: NewItemEvent): void {
    allItems.value = [
      ...allItems.value,
      { id: id++, text: evt.text, done: false },
    ];
  }

  @capture("tododone")
  #handleDone(evt: DoneItemEvent): void {
    allItems.value = allItems.value.map((item) => {
      if (item.id === evt.id) {
        return { ...item, done: !item.done };
      }
      return item;
    });
  }

  @capture("tododelete")
  #handleDelete(evt: DeleteItemEvent): void {
    allItems.value = allItems.value.filter((item) => {
      if (item.id === evt.id) {
        return false;
      }
      return true;
    });
  }

  @capture("filterchange")
  #handleFilterChange(evt: FilterChangeEvent): void {
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
