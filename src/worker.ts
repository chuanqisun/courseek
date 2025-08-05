/// <reference lib="webworker" />

import data from "./data/latest.json";
import type { CourseItem, HydrantRaw, Query } from "./types";

declare var self: DedicatedWorkerGlobalScope;

const indexData: CourseItem[] = Object.entries((data as any as HydrantRaw).classes).map(([courseId, course]) => ({
  id: courseId,
  title: course.name,
  instructor: course.inCharge,
  description: course.description,
  terms: course.terms,
  level: course.level,
  prereq: course.prereqs,
  units: [course.lectureUnits ?? 0, course.labUnits ?? 0, course.preparationUnits ?? 0].join("-") || "0",
}));

self.addEventListener("message", (event) => {
  // respond to message using the peer port
  const port = event.ports[0];
  if (!port) {
    console.error("No port found in message event");
    return;
  }

  const query = event.data as Query;

  const results = indexData.filter((course) => {
    let matches = true;

    if (query.title) {
      matches = matches && course.title.toLowerCase().includes(query.title.toLowerCase());
    }

    if (query.description) {
      matches = matches && course.description.toLowerCase().includes(query.description.toLowerCase());
    }

    if (query.semester) {
      matches = matches && course.terms.some((s) => s.toLocaleLowerCase().includes(query.semester!.toLowerCase()));
    }

    if (query.terms && query.terms.length > 0) {
      matches = matches && course.terms.some((term) => query.terms!.includes(term));
    }

    if (query.prereq) {
      matches = matches && course.prereq.toLowerCase().includes(query.prereq.toLowerCase());
    }

    if (query.units) {
      matches = matches && course.units.toLowerCase().includes(query.units.toLowerCase());
    }

    return matches;
  });

  port.postMessage({ results });
});
