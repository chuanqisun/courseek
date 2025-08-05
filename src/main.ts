import "@lit-labs/virtualizer";
import type { RenderItemFunction } from "@lit-labs/virtualizer/virtualize.js";
import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { BehaviorSubject, combineLatest, ignoreElements, map, merge, mergeWith, switchMap, tap } from "rxjs";
import "./main.css";
import { createComponent } from "./sdk/create-component";
import { observe } from "./sdk/observe-directive";
import { type Query, type SearchableCourse, type UnitsFilter } from "./types";
import { useSearchParam } from "./url/url";
import Worker from "./worker?worker";

const worker = new Worker();

const Main = createComponent(() => {
  const title = useSearchParam<string>({ name: "title", initialValue: "" });
  const numbers = useSearchParam<string>({ name: "numbers", initialValue: "" });
  const selectedTerms = useSearchParam<("FA" | "JA" | "SP" | "SU")[]>({
    name: "terms",
    initialValue: ["FA"],
    codec: {
      encode: (value) => value.join(","),
      decode: (value) => (value ? (value.split(",") as ("FA" | "JA" | "SP" | "SU")[]) : []),
    },
  });
  const selectedLevel = useSearchParam<"G" | "U" | "">({
    name: "level",
    initialValue: "",
  });
  const selectedSort = useSearchParam<"relevance" | "rating" | "hours" | "size" | "number">({
    name: "sort",
    initialValue: "relevance",
  });
  const selectedSortDirection = useSearchParam<"high" | "low" | "long" | "short" | "large" | "small">({
    name: "sortDir",
    initialValue: "high",
  });
  const requireEval = useSearchParam<boolean>({
    name: "requireEval",
    initialValue: false,
  });
  const halfTerm = useSearchParam<boolean>({
    name: "halfTerm",
    initialValue: false,
  });
  const noPrereq = useSearchParam<boolean>({
    name: "noPrereq",
    initialValue: false,
  });
  const noFinal = useSearchParam<boolean>({
    name: "noFinal",
    initialValue: false,
  });

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
          value.minHours ?? "",
          value.maxHours ?? "",
          value.minSize ?? "",
          value.maxSize ?? "",
          value.minRating ?? "",
          value.maxRating ?? "",
        ];
        const hasAnyValue = values.some((v) => v !== "");
        return hasAnyValue ? values.join(",") : "";
      },
      decode: (value) => {
        if (!value) return defaultUnits;
        const parts = value.split(",");
        if (parts.length !== 14) return defaultUnits;
        return {
          minUnits: parts[0] ? parseInt(parts[0], 10) || 0 : undefined,
          maxUnits: parts[1] ? parseInt(parts[1], 10) || 0 : undefined,
          minLectureUnits: parts[2] ? parseInt(parts[2], 10) || 0 : undefined,
          maxLectureUnits: parts[3] ? parseInt(parts[3], 10) || 0 : undefined,
          minLabUnits: parts[4] ? parseInt(parts[4], 10) || 0 : undefined,
          maxLabUnits: parts[5] ? parseInt(parts[5], 10) || 0 : undefined,
          minPrepUnits: parts[6] ? parseInt(parts[6], 10) || 0 : undefined,
          maxPrepUnits: parts[7] ? parseInt(parts[7], 10) || 0 : undefined,
          minHours: parts[8] ? parseInt(parts[8], 10) || 0 : undefined,
          maxHours: parts[9] ? parseInt(parts[9], 10) || 0 : undefined,
          minSize: parts[10] ? parseInt(parts[10], 10) || 0 : undefined,
          maxSize: parts[11] ? parseInt(parts[11], 10) || 0 : undefined,
          minRating: parts[12] ? parseFloat(parts[12]) || 0 : undefined,
          maxRating: parts[13] ? parseFloat(parts[13]) || 0 : undefined,
        };
      },
    },
  });
  const activeItems$ = new BehaviorSubject<SearchableCourse[]>([]);

  const handleTitleChange = (event: Event) => {
    title.replace((event.target as HTMLInputElement).value.trim());
  };

  const handleNumbersChange = (event: Event) => {
    numbers.replace((event.target as HTMLInputElement).value.trim());
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

  const handleSortChange = (event: Event) => {
    const radio = event.target as HTMLInputElement;
    const newSort = radio.value as "relevance" | "rating" | "hours" | "size" | "number";
    selectedSort.set(newSort);

    // Set default direction for each sort type
    switch (newSort) {
      case "relevance":
        selectedSortDirection.set("high"); // Always high relevance first
        break;
      case "rating":
        selectedSortDirection.set("high");
        break;
      case "hours":
        selectedSortDirection.set("short");
        break;
      case "size":
        selectedSortDirection.set("small");
        break;
      case "number":
        selectedSortDirection.set("low");
        break;
    }
  };

  const handleSortDirectionChangeForDimension =
    (sortType: "relevance" | "rating" | "hours" | "size" | "number") => () => {
      // First, switch to this sort dimension if not already selected
      if (selectedSort.value$.value !== sortType) {
        selectedSort.set(sortType);
        // Set default direction for the new sort type
        switch (sortType) {
          case "relevance":
            selectedSortDirection.set("high"); // Always high relevance first
            break;
          case "rating":
            selectedSortDirection.set("high");
            break;
          case "hours":
            selectedSortDirection.set("short");
            break;
          case "size":
            selectedSortDirection.set("small");
            break;
          case "number":
            selectedSortDirection.set("low");
            break;
        }
      } else {
        // If already selected, toggle the direction (except for relevance which is always high)
        if (sortType === "relevance") {
          return; // No toggle for relevance, always high
        }

        const currentDirection = selectedSortDirection.value$.value;
        switch (sortType) {
          case "rating":
            selectedSortDirection.set(currentDirection === "high" ? "low" : "high");
            break;
          case "hours":
            selectedSortDirection.set(currentDirection === "short" ? "long" : "short");
            break;
          case "size":
            selectedSortDirection.set(currentDirection === "small" ? "large" : "small");
            break;
          case "number":
            selectedSortDirection.set(currentDirection === "low" ? "high" : "low");
            break;
        }
      }
    };

  const handleRequireEvalChange = (event: Event) => {
    const checkbox = event.target as HTMLInputElement;
    requireEval.set(checkbox.checked);
  };

  const handleHalfTermChange = (event: Event) => {
    const checkbox = event.target as HTMLInputElement;
    halfTerm.set(checkbox.checked);
  };

  const handleNoPrereqChange = (event: Event) => {
    const checkbox = event.target as HTMLInputElement;
    noPrereq.set(checkbox.checked);
  };

  const handleNoFinalChange = (event: Event) => {
    const checkbox = event.target as HTMLInputElement;
    noFinal.set(checkbox.checked);
  };

  const handleUnitsChange = (field: keyof UnitsFilter) => (event: Event) => {
    const input = event.target as HTMLInputElement;
    const inputValue = input.value.trim();
    let value: number | undefined;

    if (inputValue === "") {
      value = undefined;
    } else if (field === "minRating" || field === "maxRating") {
      value = parseFloat(inputValue) || 0;
    } else {
      value = parseInt(inputValue, 10) || 0;
    }

    const currentUnits = units.value$.value;
    units.set({ ...currentUnits, [field]: value });
  };

  const handleReset = () => {
    title.set("");
    numbers.set("");
    selectedTerms.set([]);
    selectedLevel.set("");
    selectedSort.set("relevance");
    selectedSortDirection.set("high");
    requireEval.set(false);
    halfTerm.set(false);
    noPrereq.set(false);
    noFinal.set(false);
    units.set(defaultUnits);
  };

  const handleDownloadLLMsTxt = () => {
    const items = activeItems$.value;
    const content = items
      .map((item) => {
        return `## ${item.title}\nDescription: ${item.description}\n`;
      })
      .join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "llms.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const search$ = combineLatest([
    title.value$,
    numbers.value$,
    selectedTerms.value$,
    selectedLevel.value$,
    selectedSort.value$,
    selectedSortDirection.value$,
    requireEval.value$,
    halfTerm.value$,
    noPrereq.value$,
    noFinal.value$,
    units.value$,
  ]).pipe(
    tap({ subscribe: () => console.log("searching...") }),
    switchMap(
      async ([
        titleValue,
        numbersValue,
        selectedTerms,
        selectedLevel,
        selectedSort,
        selectedSortDirection,
        requireEval,
        halfTermValue,
        noPrereqValue,
        noFinalValue,
        unitsValue,
      ]) => {
        const fullQuery: Query = {
          keywords: titleValue,
          numbers: numbersValue,
          terms: selectedTerms.length > 0 ? selectedTerms : undefined,
          level: selectedLevel || undefined,
          sort: selectedSort,
          sortDirection: selectedSortDirection,
          requireEval,
          halfTerm: halfTermValue,
          noPrereq: noPrereqValue,
          noFinal: noFinalValue,
          minUnits: unitsValue.minUnits,
          maxUnits: unitsValue.maxUnits,
          minLectureUnits: unitsValue.minLectureUnits,
          maxLectureUnits: unitsValue.maxLectureUnits,
          minLabUnits: unitsValue.minLabUnits,
          maxLabUnits: unitsValue.maxLabUnits,
          minPrepUnits: unitsValue.minPrepUnits,
          maxPrepUnits: unitsValue.maxPrepUnits,
          minHours: unitsValue.minHours,
          maxHours: unitsValue.maxHours,
          minSize: unitsValue.minSize,
          maxSize: unitsValue.maxSize,
          minRating: unitsValue.minRating,
          maxRating: unitsValue.maxRating,
        };
        const ports = new MessageChannel();
        worker.postMessage(fullQuery, [ports.port2]);

        return new Promise<SearchableCourse[]>((resolve) => {
          ports.port1.onmessage = (event) => {
            const { results } = event.data;
            activeItems$.next(results as SearchableCourse[]);
            resolve(results as SearchableCourse[]);
          };
        });
      },
    ),
    tap((results) => activeItems$.next(results)),
  );

  const effects$ = merge(search$).pipe(ignoreElements());
  const template = combineLatest([
    activeItems$,
    selectedTerms.value$,
    selectedLevel.value$,
    selectedSort.value$,
    selectedSortDirection.value$,
    requireEval.value$,
    halfTerm.value$,
    noPrereq.value$,
    noFinal.value$,
    units.value$,
  ]).pipe(
    map(
      ([
        items,
        currentTerms,
        currentLevel,
        currentSort,
        currentSortDirection,
        currentRequireEval,
        currentHalfTerm,
        currentNoPrereq,
        currentNoFinal,
      ]) => {
        const renderItem: RenderItemFunction<SearchableCourse> = (item) => {
          if (!item?.id) return null;
          return html`<div class="course-card">
            <div class="course-title">
              <strong>
                <a
                  href="https://student.mit.edu/catalog/search.cgi?search=${item.id}"
                  target="_blank"
                  class="course-eval-link"
                  >${item.courseIdHTML ? unsafeHTML(item.courseIdHTML) : item.id}
                  ${item.titleHTML ? unsafeHTML(item.titleHTML) : item.title}</a
                >
              </strong>
              <div class="course-meta-primary">
                <span title="${item.level === "G" ? "Graduate" : item.level === "U" ? "Undergraduate" : ""}"
                  >${item.level}</span
                >
                ·
                <span
                  title="${item.units[0]} hours of lecture/recitation, ${item.units[1]} hour lab/design/field, ${item
                    .units[2]} hours of preparation"
                  >${item.units[0]}-${item.units[1]}-${item.units[2]} units</span
                >
                ·
                <span
                  title="${item.terms
                    .map((term) => {
                      switch (term) {
                        case "FA":
                          return "Fall";
                        case "JA":
                          return "January (IAP)";
                        case "SP":
                          return "Spring";
                        case "SU":
                          return "Summer";
                        default:
                          return term;
                      }
                    })
                    .join(", ")}"
                  >${item.terms.join(", ")}</span
                >
                ·
                <a
                  href="https://eduapps.mit.edu/ose-rpt/subjectEvaluationSearch.htm?search=Search&subjectCode=${item.id}"
                  target="_blank"
                  class="course-eval-link"
                  title="Course evaluation data from student feedback"
                  ><span title="Average hours per week spent on this course"
                    >${parseFloat(item.hours.toFixed(2))} hrs</span
                  >
                  <span title="Average rating score from student evaluations"
                    >${parseFloat(item.rating.toFixed(2))} pts</span
                  >
                  <span title="Average class size (number of students)"
                    >${parseFloat(item.size.toFixed(2))} ppl</span
                  ></a
                >
              </div>
            </div>

            <div class="course-description">
              ${item.descriptionHTML ? unsafeHTML(item.descriptionHTML) : item.description}
            </div>

            <div class="course-meta-secondary">
              ${item.instructor ? html`${item.instructor} · ` : ""}Prereq: ${item.prereq}
              ${item.half ? html` · Half term` : ""} ${!item.final ? html` · No final` : ""}
            </div>
          </div>` as any;
        };

        return html`
          <div class="two-column-layout">
            <div class="search-form">
              <div class="form-section">
                <label class="block-field">
                  <b>Keywords</b>
                  <input type="search" name="title" @input=${handleTitleChange} .value=${observe(title.value$)} />
                </label>

                <label class="block-field">
                  <b>Numbers</b>
                  <input
                    type="search"
                    name="numbers"
                    @input=${handleNumbersChange}
                    .value=${observe(numbers.value$)}
                    placeholder="6.001, MAS, 21M"
                  />
                </label>

                <p>${items.length} courses</p>
              </div>

              <div class="form-actions">
                <button type="button" @click=${handleReset}>Reset</button>
                <button type="button" @click=${handleDownloadLLMsTxt}>llms.txt</button>
              </div>

              <fieldset>
                <legend>Sort by</legend>
                <label
                  ><input type="checkbox" @change=${handleRequireEvalChange} .checked=${currentRequireEval} /> Require
                  eval</label
                >
                <label class="sort-label"
                  ><input
                    type="radio"
                    name="sort"
                    value="relevance"
                    @change=${handleSortChange}
                    .checked=${currentSort === "relevance"}
                  />
                  Relevance</label
                >
                <label class="sort-label"
                  ><input
                    type="radio"
                    name="sort"
                    value="rating"
                    @change=${handleSortChange}
                    .checked=${currentSort === "rating"}
                  />
                  Rating
                  <button type="button" @click=${handleSortDirectionChangeForDimension("rating")}>
                    ${currentSort === "rating" ? (currentSortDirection === "high" ? "high" : "low") : "high"}
                  </button></label
                >
                <label class="sort-label"
                  ><input
                    type="radio"
                    name="sort"
                    value="hours"
                    @change=${handleSortChange}
                    .checked=${currentSort === "hours"}
                  />
                  Hours
                  <button type="button" @click=${handleSortDirectionChangeForDimension("hours")}>
                    ${currentSort === "hours" ? (currentSortDirection === "short" ? "short" : "long") : "short"}
                  </button></label
                >
                <label class="sort-label"
                  ><input
                    type="radio"
                    name="sort"
                    value="size"
                    @change=${handleSortChange}
                    .checked=${currentSort === "size"}
                  />
                  Size
                  <button type="button" @click=${handleSortDirectionChangeForDimension("size")}>
                    ${currentSort === "size" ? (currentSortDirection === "small" ? "small" : "large") : "small"}
                  </button></label
                >
                <label class="sort-label"
                  ><input
                    type="radio"
                    name="sort"
                    value="number"
                    @change=${handleSortChange}
                    .checked=${currentSort === "number"}
                  />
                  Number
                  <button type="button" @click=${handleSortDirectionChangeForDimension("number")}>
                    ${currentSort === "number" ? (currentSortDirection === "low" ? "low" : "high") : "low"}
                  </button></label
                >
              </fieldset>

              <fieldset>
                <legend>Terms</legend>
                <label
                  ><input type="checkbox" @change=${handleTermChange("FA")} .checked=${currentTerms.includes("FA")} />
                  Fall 25</label
                >
                <label
                  ><input type="checkbox" @change=${handleTermChange("JA")} .checked=${currentTerms.includes("JA")} />
                  January 26 (IAP)</label
                >
                <label
                  ><input type="checkbox" @change=${handleTermChange("SP")} .checked=${currentTerms.includes("SP")} />
                  Spring 26</label
                >
                <label
                  ><input type="checkbox" @change=${handleTermChange("SU")} .checked=${currentTerms.includes("SU")} />
                  Summer 26</label
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
                <label title="Undergraduate"
                  ><input
                    type="radio"
                    name="level"
                    value="U"
                    @change=${handleLevelChange}
                    .checked=${currentLevel === "U"}
                  />
                  Undergraduate</label
                >
                <label title="Graduate"
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
                <legend>Features</legend>
                <label
                  ><input type="checkbox" @change=${handleHalfTermChange} .checked=${currentHalfTerm} /> Half
                  term</label
                >
                <label
                  ><input type="checkbox" @change=${handleNoPrereqChange} .checked=${currentNoPrereq} /> No
                  prereq</label
                >
                <label
                  ><input type="checkbox" @change=${handleNoFinalChange} .checked=${currentNoFinal} /> No final</label
                >
              </fieldset>

              <fieldset>
                <legend>Total units</legend>
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
                <legend>Lecture units</legend>
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
                <legend>Lab units</legend>
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
                <legend>Prep units</legend>
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

              <fieldset>
                <legend>Rating</legend>
                <div class="form-row">
                  <label>
                    Min
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      @input=${handleUnitsChange("minRating")}
                      .value=${observe(units.value$.pipe(map((v) => v.minRating?.toString() || "")))}
                    />
                  </label>
                  <label>
                    Max
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      @input=${handleUnitsChange("maxRating")}
                      .value=${observe(units.value$.pipe(map((v) => v.maxRating?.toString() || "")))}
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset>
                <legend>Hours</legend>
                <div class="form-row">
                  <label>
                    Min
                    <input
                      type="number"
                      min="0"
                      @input=${handleUnitsChange("minHours")}
                      .value=${observe(units.value$.pipe(map((v) => v.minHours?.toString() || "")))}
                    />
                  </label>
                  <label>
                    Max
                    <input
                      type="number"
                      min="0"
                      @input=${handleUnitsChange("maxHours")}
                      .value=${observe(units.value$.pipe(map((v) => v.maxHours?.toString() || "")))}
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset>
                <legend>Size</legend>
                <div class="form-row">
                  <label>
                    Min
                    <input
                      type="number"
                      min="0"
                      @input=${handleUnitsChange("minSize")}
                      .value=${observe(units.value$.pipe(map((v) => v.minSize?.toString() || "")))}
                    />
                  </label>
                  <label>
                    Max
                    <input
                      type="number"
                      min="0"
                      @input=${handleUnitsChange("maxSize")}
                      .value=${observe(units.value$.pipe(map((v) => v.maxSize?.toString() || "")))}
                    />
                  </label>
                </div>
              </fieldset>
              <a class="support-link" href="https://github.com/chuanqisun/courseek">File a bug</a>
            </div>

            <div class="results-panel">
              ${items.length === 0
                ? html`<div style="color: #888; padding: 2ch;">No course found</div>`
                : html`<lit-virtualizer
                    .items=${items}
                    .keyFunction=${(item: any) => {
                      return item?.id;
                    }}
                    .renderItem=${renderItem}
                  ></lit-virtualizer>`}
            </div>
          </div>
        `;
      },
    ),
    mergeWith(effects$),
  );

  return template;
});

async function start() {
  render(Main(), document.getElementById("app")!);
}

start();
