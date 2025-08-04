import { html, render } from "lit-html";
import { repeat } from "lit-html/directives/repeat.js";
import { BehaviorSubject, debounceTime, ignoreElements, map, merge, mergeWith, switchMap, tap } from "rxjs";
import "./main.css";
import { createComponent } from "./sdk/create-component";
import { observe } from "./sdk/observe-directive";
import { type CourseItem, type Query } from "./types";
import { useSearchParam } from "./url/url";
import Worker from "./worker?worker";

const worker = new Worker();

const Main = createComponent(() => {
  const title = useSearchParam<string>({ name: "title", initialValue: "" });
  const activeItems$ = new BehaviorSubject<CourseItem[]>([]);

  const handleTitleChange = (event: Event) => {
    title.replace((event.target as HTMLInputElement).value.trim());
  };

  const search$ = title.value$.pipe(
    tap({ subscribe: () => console.log("searching...") }),
    debounceTime(200),
    switchMap(async (title) => {
      const fullQuery: Query = { title };
      const ports = new MessageChannel();
      worker.postMessage(fullQuery, [ports.port2]);

      return new Promise<CourseItem[]>((resolve) => {
        ports.port1.onmessage = (event) => {
          const { results } = event.data;
          activeItems$.next(results as CourseItem[]);
          resolve(results as CourseItem[]);
        };
      });
    }),
    tap((results) => activeItems$.next(results)),
  );

  const effects$ = merge(search$).pipe(ignoreElements());
  const template = activeItems$.pipe(
    map(
      (items) => html`
        <input type="text" name="title" @input=${handleTitleChange} .value=${observe(title.value$)} />

        <h2>Results (${items.length})</h2>
        <ul>
          ${repeat(
            items,
            (item) => item.id,
            (item) =>
              html`<li>
                <strong>${item.title}</strong> (${item.units} units, ${item.level})<br />
                <em>${item.instructor}</em><br />
                <p>${item.description}</p>
                <small>Semester: ${item.semesters.join(" | ")}</small>
                <small>Prereq: ${item.prereq}</small>
              </li>`,
          )}
        </ul>
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
