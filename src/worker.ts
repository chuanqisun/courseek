/// <reference lib="webworker" />

import data from "./data/latest.json";
import type { CourseItem, HydrantRaw, Query } from "./types";

declare var self: DedicatedWorkerGlobalScope;

const indexData: CourseItem[] = Object.entries((data as any as HydrantRaw).classes).map(([, course]) => ({
  id: course.number,
  title: course.name,
  description: course.description,
  instructor: course.inCharge,
  terms: course.terms,
  level: course.level,
  prereq: course.prereqs,
  units: [course.lectureUnits ?? 0, course.labUnits ?? 0, course.preparationUnits ?? 0],
  hours: course.hours,
  rating: course.rating,
  size: course.size,
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

    if (query.keywords) {
      matches = matches && course.title.toLowerCase().includes(query.keywords.toLowerCase());
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

    if (query.minHours !== undefined || query.maxHours !== undefined) {
      const lowerbound = query.minHours ?? 0;
      const upperbound = query.maxHours ?? Infinity;
      matches = matches && course.hours >= lowerbound && course.hours <= upperbound;
    }

    if (query.minSize !== undefined || query.maxSize !== undefined) {
      const lowerbound = query.minSize ?? 0;
      const upperbound = query.maxSize ?? Infinity;
      matches = matches && course.size >= lowerbound && course.size <= upperbound;
    }

    if (query.requireEval) {
      // Filter out courses with no evaluation data (0 hours, 0 rating, or 0 size)
      matches = matches && course.hours > 0 && course.rating > 0 && course.size > 0;
    }

    return matches;
  });

  // Sort results based on the sort parameter
  if (query.sort) {
    results.sort((a, b) => {
      let comparison = 0;

      switch (query.sort) {
        case "rating":
          comparison = b.rating - a.rating; // Default: higher rating first
          if (query.sortDirection === "low") comparison = -comparison;
          break;
        case "hours":
          comparison = a.hours - b.hours; // Default: lower hours first
          if (query.sortDirection === "long") comparison = -comparison;
          break;
        case "size":
          comparison = a.size - b.size; // Default: lower size first
          if (query.sortDirection === "large") comparison = -comparison;
          break;
        default:
          return 0;
      }

      return comparison;
    });
  }

  port.postMessage({ results });
});
