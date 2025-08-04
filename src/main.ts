import { html, render } from "lit-html";
import { BehaviorSubject, map } from "rxjs";
import "./main.css";
import { createComponent } from "./sdk/create-component";
import { type CourseItemRaw, type Query } from "./types";
import Worker from "./worker?worker";

const worker = new Worker();

const Main = createComponent(() => {
  const handleTitleChange = (event: Event) => {
    const titleQuery = (event.target as HTMLInputElement).value.trim();
    const fullQuery: Query = { title: titleQuery };
    const ports = new MessageChannel();
    worker.postMessage(fullQuery, [ports.port2]);

    ports.port1.onmessage = (event) => {
      const { results } = event.data;
      console.log("Worker results:", results);
      activeItems$.next(results as CourseItemRaw[]);
    };
  };

  const activeItems$ = new BehaviorSubject<CourseItemRaw[]>([]);

  const template = activeItems$.pipe(
    map(
      (items) => html`
        <input type="text" name="title" @input=${handleTitleChange} />

        <h2>Results (${items.length})</h2>
      `,
    ),
  );

  return template;
});

async function start() {
  render(Main(), document.getElementById("app")!);
}

start();
