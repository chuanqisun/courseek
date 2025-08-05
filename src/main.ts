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
  const selectedTerms = useSearchParam<("FA" | "JA" | "SP" | "SU")[]>({
    name: "terms",
    initialValue: [],
    codec: {
      encode: (value) => value.join(","),
      decode: (value) => (value ? (value.split(",") as ("FA" | "JA" | "SP" | "SU")[]) : []),
    },
  });
  const selectedLevel = useSearchParam<"G" | "U" | "">({
    name: "level",
    initialValue: "",
  });
  const activeItems$ = new BehaviorSubject<CourseItem[]>([]);

  const handleTitleChange = (event: Event) => {
    title.replace((event.target as HTMLInputElement).value.trim());
  };

  const handleTermChange = (term: "FA" | "JA" | "SP" | "SU") => (event: Event) => {
    const checkbox = event.target as HTMLInputElement;
    const currentTerms = selectedTerms.value$.value;

    if (checkbox.checked) {
      selectedTerms.set([...currentTerms, term]);
    } else {
      selectedTerms.set(currentTerms.filter((t) => t !== term));
    }
  };

  const handleLevelChange = (event: Event) => {
    const radio = event.target as HTMLInputElement;
    selectedLevel.set(radio.value as "G" | "U" | "");
  };

  const search$ = combineLatest([title.value$, selectedTerms.value$, selectedLevel.value$]).pipe(
    tap({ subscribe: () => console.log("searching...") }),
    switchMap(async ([titleValue, selectedTerms, selectedLevel]) => {
      const fullQuery: Query = {
        title: titleValue,
        terms: selectedTerms.length > 0 ? selectedTerms : undefined,
        level: selectedLevel || undefined,
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
  const template = combineLatest([activeItems$, selectedTerms.value$, selectedLevel.value$]).pipe(
    map(([items, currentTerms, currentLevel]) => {
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
          <label
            ><input type="checkbox" @change=${handleTermChange("FA")} .checked=${currentTerms.includes("FA")} /> FA
            (Fall)</label
          >
          <label
            ><input type="checkbox" @change=${handleTermChange("JA")} .checked=${currentTerms.includes("JA")} /> JA
            (January)</label
          >
          <label
            ><input type="checkbox" @change=${handleTermChange("SP")} .checked=${currentTerms.includes("SP")} /> SP
            (Spring)</label
          >
          <label
            ><input type="checkbox" @change=${handleTermChange("SU")} .checked=${currentTerms.includes("SU")} /> SU
            (Summer)</label
          >
        </fieldset>

        <fieldset>
          <legend>Level</legend>
          <label
            ><input type="radio" name="level" value="" @change=${handleLevelChange} .checked=${currentLevel === ""} />
            Both</label
          >
          <label
            ><input type="radio" name="level" value="U" @change=${handleLevelChange} .checked=${currentLevel === "U"} />
            Undergraduate</label
          >
          <label
            ><input type="radio" name="level" value="G" @change=${handleLevelChange} .checked=${currentLevel === "G"} />
            Graduate</label
          >
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
