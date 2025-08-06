/// <reference lib="webworker" />

import data from "./data/latest.json";
import type { CourseItem, HydrantRaw, Query, SearchableCourse, WorkerResponseData } from "./types";

declare var self: DedicatedWorkerGlobalScope;

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

  // Check for substring match, 15 points per match
  if (haystack.includes(needle)) {
    return 15;
  }

  return 0;
}

/**
 * Create highlighted HTML for matching text with multiple keywords
 */
function highlightMatches(text: string, searchTerm: string): string {
  if (!searchTerm) return text;

  // Parse keywords by comma separator
  const keywords = searchTerm
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  if (keywords.length === 0) return text;

  let highlightedText = text;

  // Apply highlighting for each keyword
  for (const keyword of keywords) {
    // Escape special regex characters in the keyword
    const escapedTerm = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escapedTerm})`, "gi");
    highlightedText = highlightedText.replace(regex, "<mark>$1</mark>");
  }

  return highlightedText;
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

  let results: CourseItem[] = indexData.filter((course) => {
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
        .map((n) => n.trim().toLowerCase())
        .filter((n) => n.length > 0);

      if (numberPrefixes.length > 0) {
        matches = matches && numberPrefixes.some((prefix) => course.id.toLowerCase().startsWith(prefix));
      }
    }

    return matches;
  });

  // Parse number prefixes for highlighting
  const numberPrefixes = query.numbers
    ? query.numbers
        .split(",")
        .map((n) => n.trim())
        .filter((n) => n.length > 0)
    : [];

  // Add HTML highlighting for all results
  let sortedResults: SearchableCourse[] = results.map((course) => {
    let titleHTML = course.title;
    let descriptionHTML = course.description;
    let courseIdHTML = course.id;
    let instructorHTML = course.instructor;

    // Apply keyword highlighting if present
    if (query.keywords) {
      titleHTML = highlightMatches(titleHTML, query.keywords);
      descriptionHTML = highlightMatches(descriptionHTML, query.keywords);
      instructorHTML = highlightMatches(instructorHTML, query.keywords);
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
      instructorHTML,
      score: 0, // Default score
    } as SearchableCourse;
  });

  // Enhanced keyword search with scoring
  if (query.keywords) {
    // Parse keywords by comma separator
    const keywords = query.keywords
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0);

    if (keywords.length > 0) {
      // Calculate scores for courses with keyword matches (OR logic)
      sortedResults = sortedResults
        .map((course) => {
          let totalTitleScore = 0;
          let totalDescriptionScore = 0;
          let totalInstructorScore = 0;
          let matchingKeywordsCount = 0;

          // Add up scores from all matching keywords for each field
          for (const keyword of keywords) {
            const titleScore = getMatchScore(keyword, course.title);
            const descriptionScore = getMatchScore(keyword, course.description);
            const instructorScore = getMatchScore(keyword, course.instructor);

            totalTitleScore += titleScore;
            totalDescriptionScore += descriptionScore;
            totalInstructorScore += instructorScore;

            // Count this keyword as matching if any field has a score > 0
            if (titleScore > 0 || descriptionScore > 0 || instructorScore > 0) {
              matchingKeywordsCount++;
            }
          }

          const baseScore = totalTitleScore + totalDescriptionScore * 0.75 + totalInstructorScore * 0.9;

          // Apply bonus for multiple keyword matches
          // Bonus increases exponentially: 1 match = 1x, 2 matches = 10x, 3 matches = 100x, etc.
          const multiMatchBonus = Math.pow(10, matchingKeywordsCount - 1);
          const totalScore = baseScore * multiMatchBonus;

          return { ...course, score: totalScore };
        })
        .filter((course) => course.score > 0)
        .sort((a, b) => b.score - a.score); // Sort by score descending
    }
  }

  // Sort results based on the sort parameter
  if (query.sort) {
    sortedResults.sort((a, b) => {
      let comparison = 0;

      switch (query.sort) {
        case "relevance":
          comparison = ((b as SearchableCourse).score || 0) - ((a as SearchableCourse).score || 0); // Always higher relevance first
          break;
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
        case "number":
          // Sort course numbers alphanumerically (0-9a-z)
          // Examples: "6.001" < "11.S197" < "21W.225" < "STS.095"
          const getNormalizedCourseId = (courseId: string): string => {
            // Split by periods and process each part
            return courseId
              .split(".")
              .map((part) => {
                // For each part, separate numbers and letters
                // e.g., "21W" -> "021W", "S197" -> "S197", "001" -> "001"
                const match = part.match(/^(\d*)([A-Za-z]*)(\d*)$/);
                if (match) {
                  const [, leadingNum, letters, trailingNum] = match;
                  // Pad numbers with zeros for proper sorting
                  const paddedLeadingNum = leadingNum ? leadingNum.padStart(4, "0") : "";
                  const paddedTrailingNum = trailingNum ? trailingNum.padStart(4, "0") : "";
                  return paddedLeadingNum + letters.toUpperCase() + paddedTrailingNum;
                }
                return part.toUpperCase();
              })
              .join(".");
          };

          const aNormalized = getNormalizedCourseId(a.id);
          const bNormalized = getNormalizedCourseId(b.id);
          comparison = aNormalized.localeCompare(bNormalized); // Default: alphanumeric order
          if (query.sortDirection === "high") comparison = -comparison;
          break;
        default:
          return 0;
      }

      return comparison;
    });
  }

  port.postMessage({ results: sortedResults, lastUpdated: data.lastUpdated } satisfies WorkerResponseData);
});
