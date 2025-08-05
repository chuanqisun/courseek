/// <reference lib="webworker" />

import data from "./data/latest.json";
import type { CourseItem, HydrantRaw, Query } from "./types";

declare var self: DedicatedWorkerGlobalScope;

// Enhanced search result interface
interface SearchableCourse extends CourseItem {
  score: number;
  titleHTML: string;
  descriptionHTML: string;
}

/**
 * Calculate match score for search terms
 * +1000 if needle and haystack are equal
 * +100 if haystack starts with needle
 * +10 for each word in the haystack that starts with needle
 */
function getMatchScore(needle: string, haystack: string): number {
  needle = needle.toLowerCase();
  haystack = haystack.toLowerCase();

  // Exact match
  if (needle === haystack) {
    return 1000;
  }

  // Prefix match
  if (haystack.startsWith(needle)) {
    return 100;
  }

  // Check for substring match, 15 points per match
  if (haystack.includes(needle)) {
    return 15;
  }

  // Check if any word in haystack starts with needle
  const words = haystack.split(/\s+/);
  let wordStartScore = 0;

  for (const word of words) {
    if (word.startsWith(needle)) {
      wordStartScore += 10;
    }
  }

  if (wordStartScore > 0) {
    return wordStartScore;
  }

  return 0;
}

/**
 * Create highlighted HTML for matching text
 */
function highlightMatches(text: string, searchTerm: string): string {
  if (!searchTerm) return text;

  // Escape special regex characters in the search term
  const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedTerm})`, "gi");
  return text.replace(regex, "<mark>$1</mark>");
}

/**
 * Create highlighted HTML for matching number prefixes
 */
function highlightNumberPrefixes(courseId: string, numberPrefixes: string[]): string {
  if (!numberPrefixes.length) return courseId;

  // Find matching prefixes and highlight them
  let highlightedId = courseId;
  for (const prefix of numberPrefixes) {
    if (courseId.toLowerCase().startsWith(prefix.toLowerCase())) {
      const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`^(${escapedPrefix})`, "i");
      highlightedId = highlightedId.replace(regex, "<mark>$1</mark>");
      break; // Only highlight the first matching prefix
    }
  }
  return highlightedId;
}

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
  half: course.half,
  final: course.final,
}));

self.addEventListener("message", (event) => {
  // respond to message using the peer port
  const port = event.ports[0];
  if (!port) {
    console.error("No port found in message event");
    return;
  }

  const query = event.data as Query;

  let results = indexData.filter((course) => {
    let matches = true;

    // Non-keyword filters remain the same
    if (query.semester) {
      matches = matches && course.terms.some((s) => s.toLocaleLowerCase().includes(query.semester!.toLowerCase()));
    }

    if (query.terms && query.terms.length > 0) {
      matches = matches && course.terms.some((term) => query.terms!.includes(term));
    }

    if (query.noPrereq) {
      matches = matches && (course.prereq.trim() === "" || course.prereq.toLowerCase() === "none");
    }

    if (query.halfTerm) {
      matches = matches && course.half;
    }

    if (query.noFinal) {
      matches = matches && !course.final;
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

    if (query.minRating !== undefined || query.maxRating !== undefined) {
      const lowerbound = query.minRating ?? 0;
      const upperbound = query.maxRating ?? Infinity;
      matches = matches && course.rating >= lowerbound && course.rating <= upperbound;
    }

    if (query.requireEval) {
      // Filter out courses with no evaluation data (0 hours, 0 rating, or 0 size)
      matches = matches && course.hours > 0 && course.rating > 0 && course.size > 0;
    }

    if (query.numbers) {
      // Filter by course number prefixes
      const numberPrefixes = query.numbers
        .split(",")
        .map(n => n.trim().toLowerCase())
        .filter(n => n.length > 0);
      
      if (numberPrefixes.length > 0) {
        matches = matches && numberPrefixes.some(prefix => 
          course.id.toLowerCase().startsWith(prefix)
        );
      }
    }

    return matches;
  });

  // Parse number prefixes for highlighting
  const numberPrefixes = query.numbers 
    ? query.numbers.split(",").map(n => n.trim()).filter(n => n.length > 0)
    : [];

  // Add HTML highlighting for all results
  const enhancedResults = results.map((course) => {
    let titleHTML = course.title;
    let descriptionHTML = course.description;
    let courseIdHTML = course.id;

    // Apply keyword highlighting if present
    if (query.keywords) {
      titleHTML = highlightMatches(titleHTML, query.keywords);
      descriptionHTML = highlightMatches(descriptionHTML, query.keywords);
    }

    // Apply number prefix highlighting if present
    if (numberPrefixes.length > 0) {
      courseIdHTML = highlightNumberPrefixes(course.id, numberPrefixes);
    }

    return {
      ...course,
      titleHTML,
      descriptionHTML,
      courseIdHTML,
      score: 0, // Default score
    } as SearchableCourse & { courseIdHTML: string };
  });

  // Enhanced keyword search with scoring
  if (query.keywords) {
    const normalizedKeywords = query.keywords.toLowerCase().trim();

    // Calculate scores for courses with keyword matches
    const scoredResults = enhancedResults
      .map((course) => {
        const titleScore = getMatchScore(normalizedKeywords, course.title);
        const descriptionScore = getMatchScore(normalizedKeywords, course.description);
        const totalScore = Math.max(titleScore, descriptionScore * 0.8); // Weight title matches higher

        return { ...course, score: totalScore };
      })
      .filter(course => course.score > 0)
      .sort((a, b) => b.score - a.score); // Sort by score descending

    results = scoredResults;
  } else {
    results = enhancedResults;
  }

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
