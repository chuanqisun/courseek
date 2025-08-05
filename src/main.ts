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

  interface UnitsFilter {
    minUnits?: number;
    maxUnits?: number;
    minLectureUnits?: number;
    maxLectureUnits?: number;
    minLabUnits?: number;
    maxLabUnits?: number;
    minPrepUnits?: number;
    maxPrepUnits?: number;
  }

  const defaultUnits: UnitsFilter = {};

  const units = useSearchParam<UnitsFilter>({
    name: "units",
    initialValue: defaultUnits,
    codec: {
      encode: (value) => {
        const values = [
          value.minUnits ?? "",
          value.maxUnits ?? "",
          value.minLectureUnits ?? "",
          value.maxLectureUnits ?? "",
          value.minLabUnits ?? "",
          value.maxLabUnits ?? "",
          value.minPrepUnits ?? "",
          value.maxPrepUnits ?? "",
        ];
        const hasAnyValue = values.some((v) => v !== "");
        return hasAnyValue ? values.join(",") : "";
      },
      decode: (value) => {
        if (!value) return defaultUnits;
        const parts = value.split(",");
        if (parts.length !== 8) return defaultUnits;
        return {
          minUnits: parts[0] ? parseInt(parts[0], 10) || 0 : undefined,
          maxUnits: parts[1] ? parseInt(parts[1], 10) || 0 : undefined,
          minLectureUnits: parts[2] ? parseInt(parts[2], 10) || 0 : undefined,
          maxLectureUnits: parts[3] ? parseInt(parts[3], 10) || 0 : undefined,
          minLabUnits: parts[4] ? parseInt(parts[4], 10) || 0 : undefined,
          maxLabUnits: parts[5] ? parseInt(parts[5], 10) || 0 : undefined,
          minPrepUnits: parts[6] ? parseInt(parts[6], 10) || 0 : undefined,
          maxPrepUnits: parts[7] ? parseInt(parts[7], 10) || 0 : undefined,
        };
      },
    },
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

  const handleUnitsChange = (field: keyof UnitsFilter) => (event: Event) => {
    const input = event.target as HTMLInputElement;
    const inputValue = input.value.trim();
    const value = inputValue === "" ? undefined : parseInt(inputValue, 10) || 0;
    const currentUnits = units.value$.value;
    units.set({ ...currentUnits, [field]: value });
  };

  const search$ = combineLatest([title.value$, selectedTerms.value$, selectedLevel.value$, units.value$]).pipe(
    tap({ subscribe: () => console.log("searching...") }),
    switchMap(async ([titleValue, selectedTerms, selectedLevel, unitsValue]) => {
      const fullQuery: Query = {
        title: titleValue,
        terms: selectedTerms.length > 0 ? selectedTerms : undefined,
        level: selectedLevel || undefined,
        minUnits: unitsValue.minUnits,
        maxUnits: unitsValue.maxUnits,
        minLectureUnits: unitsValue.minLectureUnits,
        maxLectureUnits: unitsValue.maxLectureUnits,
        minLabUnits: unitsValue.minLabUnits,
        maxLabUnits: unitsValue.maxLabUnits,
        minPrepUnits: unitsValue.minPrepUnits,
        maxPrepUnits: unitsValue.maxPrepUnits,
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
  const template = combineLatest([activeItems$, selectedTerms.value$, selectedLevel.value$, units.value$]).pipe(
    map(([items, currentTerms, currentLevel]) => {
      const renderItem: RenderItemFunction<CourseItem> = (item) =>
        html`<li>
          <strong>${item.id} ${item.title}</strong> (<span title="lecture">${item.units[0]}</span>-<span title="prep"
            >${item.units[1]}</span
          >-<span title="lab">${item.units[2]}</span> units, ${item.level})<br />
          <em>${item.instructor}</em><br />
          <p>${item.description}</p>
          <small>Terms: ${item.terms.join(" | ")}</small>
          <small>Prereq: ${item.prereq}</small>
        </li>` as any;

      return html`
        <div class="two-column-layout">
          <div class="search-form">
            <div class="form-section">
              <label class="block-field">
                <b>Search</b>
                <input type="search" name="title" @input=${handleTitleChange} .value=${observe(title.value$)} />
              </label>
            </div>

            <fieldset>
              <legend>Terms</legend>
              <label
                ><input type="checkbox" @change=${handleTermChange("FA")} .checked=${currentTerms.includes("FA")} />
                Fall</label
              >
              <label
                ><input type="checkbox" @change=${handleTermChange("JA")} .checked=${currentTerms.includes("JA")} />
                January</label
              >
              <label
                ><input type="checkbox" @change=${handleTermChange("SP")} .checked=${currentTerms.includes("SP")} />
                Spring</label
              >
              <label
                ><input type="checkbox" @change=${handleTermChange("SU")} .checked=${currentTerms.includes("SU")} />
                Summer</label
              >
            </fieldset>

            <fieldset>
              <legend>Level</legend>
              <label
                ><input
                  type="radio"
                  name="level"
                  value=""
                  @change=${handleLevelChange}
                  .checked=${currentLevel === ""}
                />
                Both</label
              >
              <label
                ><input
                  type="radio"
                  name="level"
                  value="U"
                  @change=${handleLevelChange}
                  .checked=${currentLevel === "U"}
                />
                Undergraduate</label
              >
              <label
                ><input
                  type="radio"
                  name="level"
                  value="G"
                  @change=${handleLevelChange}
                  .checked=${currentLevel === "G"}
                />
                Graduate</label
              >
            </fieldset>

            <fieldset>
              <legend>Units</legend>
              <div class="form-row">
                <label>
                  Min
                  <input
                    type="number"
                    min="0"
                    @input=${handleUnitsChange("minUnits")}
                    .value=${observe(units.value$.pipe(map((v) => v.minUnits?.toString() || "")))}
                  />
                </label>
                <label>
                  Max
                  <input
                    type="number"
                    min="0"
                    @input=${handleUnitsChange("maxUnits")}
                    .value=${observe(units.value$.pipe(map((v) => v.maxUnits?.toString() || "")))}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>Lecture Hours</legend>
              <div class="form-row">
                <label>
                  Min
                  <input
                    type="number"
                    min="0"
                    @input=${handleUnitsChange("minLectureUnits")}
                    .value=${observe(units.value$.pipe(map((v) => v.minLectureUnits?.toString() || "")))}
                  />
                </label>
                <label>
                  Max
                  <input
                    type="number"
                    min="0"
                    @input=${handleUnitsChange("maxLectureUnits")}
                    .value=${observe(units.value$.pipe(map((v) => v.maxLectureUnits?.toString() || "")))}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>Lab Hours</legend>
              <div class="form-row">
                <label>
                  Min
                  <input
                    type="number"
                    min="0"
                    @input=${handleUnitsChange("minLabUnits")}
                    .value=${observe(units.value$.pipe(map((v) => v.minLabUnits?.toString() || "")))}
                  />
                </label>
                <label>
                  Max
                  <input
                    type="number"
                    min="0"
                    @input=${handleUnitsChange("maxLabUnits")}
                    .value=${observe(units.value$.pipe(map((v) => v.maxLabUnits?.toString() || "")))}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>Prep Hours</legend>
              <div class="form-row">
                <label>
                  Min
                  <input
                    type="number"
                    min="0"
                    @input=${handleUnitsChange("minPrepUnits")}
                    .value=${observe(units.value$.pipe(map((v) => v.minPrepUnits?.toString() || "")))}
                  />
                </label>
                <label>
                  Max
                  <input
                    type="number"
                    min="0"
                    @input=${handleUnitsChange("maxPrepUnits")}
                    .value=${observe(units.value$.pipe(map((v) => v.maxPrepUnits?.toString() || "")))}
                  />
                </label>
              </div>
            </fieldset>
          </div>

          <div class="results-panel">
            <h2>Results (${items.length})</h2>
            <lit-virtualizer
              .items=${items}
              .keyFunction=${(item: any) => item.id}
              .renderItem=${renderItem}
            ></lit-virtualizer>
          </div>
        </div>
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
