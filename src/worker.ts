/// <reference lib="webworker" />

import data from "./data/latest.json";
import type { CourseItem, HydrantRaw, Query } from "./types";

declare var self: DedicatedWorkerGlobalScope;

const indexData: CourseItem[] = Object.entries((data as any as HydrantRaw).classes).map(([courseId, course]) => ({
  id: courseId,
  title: course.name,
  instructor: course.inCharge,
  description: course.description,
  semesters: course.terms,
  level: course.level,
  prereq: course.prereqs,
  units: Array.isArray(course.units) ? course.units.join("-") : course.units || "",
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
    if (query.title) {
      return course.title.toLowerCase().includes(query.title.toLowerCase());
    }

    if (query.description) {
      return course.description.toLowerCase().includes(query.description.toLowerCase());
    }
    if (query.semester) {
      return course.semesters.some((s) => s.toLocaleLowerCase().includes(query.semester!.toLowerCase()));
    }
    if (query.prereq) {
      return course.prereq.toLowerCase().includes(query.prereq.toLowerCase());
    }
    if (query.units) {
      return course.units.toLowerCase().includes(query.units.toLowerCase());
    }
    return true;
  });

  port.postMessage({ results });
});
