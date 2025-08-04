import { html, render } from "lit-html";
import { BehaviorSubject, ignoreElements, map, merge, mergeWith } from "rxjs";
import "./main.css";
import { createComponent } from "./sdk/create-component";
import { observe } from "./sdk/observe-directive";
import { type CourseItemRaw, type Query } from "./types";
import { useSearchParam } from "./url/url";
import Worker from "./worker?worker";

const worker = new Worker();

const Main = createComponent(() => {
  const title = useSearchParam<string>({ name: "title", initialValue: "" });

  const handleTitleChange = (event: Event) => {
    title.replace((event.target as HTMLInputElement).value.trim());
  };

  const search$ = title.value$.pipe(
    map((title) => {
      const fullQuery: Query = { title };
      const ports = new MessageChannel();
      worker.postMessage(fullQuery, [ports.port2]);

      ports.port1.onmessage = (event) => {
        const { results } = event.data;
        activeItems$.next(results as CourseItemRaw[]);
      };
    }),
  );

  const activeItems$ = new BehaviorSubject<CourseItemRaw[]>([]);

  const effects$ = merge(search$).pipe(ignoreElements());
  const template = activeItems$.pipe(
    map(
      (items) => html`
        <input type="text" name="title" @input=${handleTitleChange} .value=${observe(title.value$)} />

        <h2>Results (${items.length})</h2>
      `,
    ),
    mergeWith(effects$),
  );

  return template;
});

async function start() {
  render(Main(), document.getElementById("app")!);
}

start();
