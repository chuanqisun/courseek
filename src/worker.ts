/// <reference lib="webworker" />

import data from "./data/latest.json";
import type { CourseItem, HydrantRaw, Query } from "./types";

declare var self: DedicatedWorkerGlobalScope;

const indexData: CourseItem[] = Object.entries((data as any as HydrantRaw).classes).map(([courseId, course]) => ({
  id: course.number,
  title: course.name,
  instructor: course.inCharge,
  description: course.description,
  terms: course.terms,
  level: course.level,
  prereq: course.prereqs,
  units: [course.lectureUnits ?? 0, course.labUnits ?? 0, course.preparationUnits ?? 0],
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

    if (query.noPrereq) {
      matches = matches && (course.prereq.trim() === "" || course.prereq.toLowerCase() === "none");
    }

    if (query.minUnits !== undefined || query.maxUnits !== undefined) {
      const totalUnits = course.units.reduce((a, b) => a + b, 0);
      const lowerbound = query.minUnits ?? 0;
      const upperbound = query.maxUnits ?? Infinity;
      matches = matches && totalUnits >= lowerbound && totalUnits <= upperbound;
    }

    if (query.minLectureUnits !== undefined || query.maxLectureUnits !== undefined) {
      const lectureUnits = course.units[0];
      const lowerbound = query.minLectureUnits ?? 0;
      const upperbound = query.maxLectureUnits ?? Infinity;
      if (query.maxLectureUnits === 0) {
        matches = matches && lectureUnits === 0;
      } else {
        matches = matches && lectureUnits >= lowerbound && lectureUnits <= upperbound;
      }
    }

    if (query.minLabUnits !== undefined || query.maxLabUnits !== undefined) {
      const labUnits = course.units[1];
      const lowerbound = query.minLabUnits ?? 0;
      const upperbound = query.maxLabUnits ?? Infinity;
      if (query.maxLabUnits === 0) {
        matches = matches && labUnits === 0;
      } else {
        matches = matches && labUnits >= lowerbound && labUnits <= upperbound;
      }
    }

    if (query.minPrepUnits !== undefined || query.maxPrepUnits !== undefined) {
      const prepUnits = course.units[2];
      const lowerbound = query.minPrepUnits ?? 0;
      const upperbound = query.maxPrepUnits ?? Infinity;
      if (query.maxPrepUnits === 0) {
        matches = matches && prepUnits === 0;
      } else {
        matches = matches && prepUnits >= lowerbound && prepUnits <= upperbound;
      }
    }

    if (query.level) {
      matches = matches && course.level.toLowerCase() === query.level.toLowerCase();
    }

    return matches;
  });

  port.postMessage({ results });
});
