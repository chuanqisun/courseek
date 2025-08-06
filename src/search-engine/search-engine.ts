/**
 * Calculate match score for search terms
 * +1000 if needle and haystack are equal
 * +100 if haystack starts with needle
 * +10 for each word in the haystack that starts with needle
 */
export function getMatchScore(needle: string, haystack: string): number {
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
export function highlightMatches(text: string, searchTerm: string): string {
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
export function highlightNumberPrefixes(courseId: string, numberPrefixes: string[]): string {
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
