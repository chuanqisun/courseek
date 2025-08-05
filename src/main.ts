import "@lit-labs/virtualizer";
import type { RenderItemFunction } from "@lit-labs/virtualizer/virtualize.js";
import { html, render } from "lit-html";
import { BehaviorSubject, combineLatest, ignoreElements, map, merge, mergeWith, switchMap, tap } from "rxjs";
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
  const selectedTerms$ = new BehaviorSubject<("FA" | "JA" | "SP" | "SU")[]>([]);

  const handleTitleChange = (event: Event) => {
    title.replace((event.target as HTMLInputElement).value.trim());
  };

  const handleTermChange = (term: "FA" | "JA" | "SP" | "SU") => (event: Event) => {
    const checkbox = event.target as HTMLInputElement;
    const currentTerms = selectedTerms$.value;

    if (checkbox.checked) {
      selectedTerms$.next([...currentTerms, term]);
    } else {
      selectedTerms$.next(currentTerms.filter((t) => t !== term));
    }
  };

  const search$ = combineLatest([title.value$, selectedTerms$]).pipe(
    tap({ subscribe: () => console.log("searching...") }),
    switchMap(async ([titleValue, selectedTerms]) => {
      const fullQuery: Query = {
        title: titleValue,
        terms: selectedTerms.length > 0 ? selectedTerms : undefined,
      };
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
    map((items) => {
      const renderItem: RenderItemFunction<CourseItem> = (item) =>
        html`<li>
          <strong>${item.id} ${item.title}</strong> (${item.units} units, ${item.level})<br />
          <em>${item.instructor}</em><br />
          <p>${item.description}</p>
          <small>Terms: ${item.terms.join(" | ")}</small>
          <small>Prereq: ${item.prereq}</small>
        </li>` as any;

      return html`
        <input type="text" name="title" @input=${handleTitleChange} .value=${observe(title.value$)} />

        <fieldset>
          <legend>Terms</legend>
          <label><input type="checkbox" @change=${handleTermChange("FA")} /> FA (Fall)</label>
          <label><input type="checkbox" @change=${handleTermChange("JA")} /> JA (January)</label>
          <label><input type="checkbox" @change=${handleTermChange("SP")} /> SP (Spring)</label>
          <label><input type="checkbox" @change=${handleTermChange("SU")} /> SU (Summer)</label>
        </fieldset>

        <h2>Results (${items.length})</h2>
        <lit-virtualizer
          .items=${items}
          .keyFunction=${(item: any) => item.id}
          .renderItem=${renderItem}
        ></lit-virtualizer>
      `;
    }),
    mergeWith(effects$),
  );

  return template;
});

async function start() {
  render(Main(), document.getElementById("app")!);
}

start();
