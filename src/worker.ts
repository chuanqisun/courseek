/// <reference lib="webworker" />

import data from "./data/2025-fall-course.json";
import type { CourseItem, CourseItemRaw, Query } from "./types";

declare var self: DedicatedWorkerGlobalScope;

const indexData: CourseItem[] = (data as CourseItemRaw[]).map((course) => ({
  ...course,
  id: course.title.split(" - ")[0].trim(),
  title: course.title.slice(course.title.indexOf(" - ") + 3).trim(),
  semesters: course.semester
    .split(",")
    .flatMap((s) => s.split("and"))
    .map((s) => s.trim())
    .filter(Boolean),
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
