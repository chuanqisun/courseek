import { describe, expect, it } from "vitest";
import { getMatchScore, highlightMatches, highlightNumberPrefixes } from "./search-engine";

describe("getMatchScore", () => {
  describe("exact matches", () => {
    it("should return 1000 for exact match", () => {
      expect(getMatchScore("hello", "hello")).toBe(1000);
      expect(getMatchScore("Hello", "HELLO")).toBe(1000);
    });
  });

  describe("prefix matches", () => {
    it("should return 100 for prefix match", () => {
      expect(getMatchScore("hello", "hello world")).toBe(100);
      expect(getMatchScore("data", "database systems")).toBe(100);
    });
  });

  describe("word start matches", () => {
    it("should return 10 per word that starts with needle", () => {
      expect(getMatchScore("data", "computer data science")).toBe(10);
      expect(getMatchScore("c", "computer c++ programming")).toBe(100); // prefix match takes precedence
    });
  });

  describe("substring matches", () => {
    it("should return 15 for substring match", () => {
      expect(getMatchScore("data", "advanced database")).toBe(10); // word start match takes precedence
      expect(getMatchScore("script", "javascript programming")).toBe(15);
    });
  });

  describe("no matches", () => {
    it("should return 0 for no match", () => {
      expect(getMatchScore("xyz", "hello world")).toBe(0);
    });
  });

  describe("current behavior with special characters", () => {
    it("should not match across parentheses currently", () => {
      // These capture current behavior - should fail after we implement the feature
      expect(getMatchScore("object oriented", "object-oriented programming")).toBe(0);
      expect(getMatchScore("data structure", "data (structure) analysis")).toBe(0);
      expect(getMatchScore("machine learn", "machine (learning) systems")).toBe(0);
    });

    it("should not match across hyphens currently", () => {
      expect(getMatchScore("web dev", "web-development")).toBe(0);
      expect(getMatchScore("real time", "real-time systems")).toBe(0);
    });

    it("should handle c++ literally", () => {
      expect(getMatchScore("c++", "c++ programming")).toBe(100);
      expect(getMatchScore("c++", "advanced c++ concepts")).toBe(10);
      expect(getMatchScore("c++", "learning c++")).toBe(10); // word start match, not substring
    });
  });

  describe.skip("future behavior with special characters (should pass after implementation)", () => {
    it("should match across parentheses and hyphens", () => {
      expect(getMatchScore("object oriented", "object-oriented programming")).toBeGreaterThan(0);
      expect(getMatchScore("data structure", "data (structure) analysis")).toBeGreaterThan(0);
      expect(getMatchScore("machine learn", "machine (learning) systems")).toBeGreaterThan(0);
      expect(getMatchScore("web dev", "web-development")).toBeGreaterThan(0);
      expect(getMatchScore("real time", "real-time systems")).toBeGreaterThan(0);
    });

    it("should still handle c++ literally", () => {
      expect(getMatchScore("c++", "c++ programming")).toBe(100);
      expect(getMatchScore("c++", "advanced c++ concepts")).toBe(10);
      expect(getMatchScore("c++", "learning c++")).toBe(10);
    });
  });
});

describe("highlightMatches", () => {
  describe("basic highlighting", () => {
    it("should highlight single keyword", () => {
      expect(highlightMatches("hello world", "hello")).toBe("<mark>hello</mark> world");
      expect(highlightMatches("Hello World", "hello")).toBe("<mark>Hello</mark> World");
    });

    it("should highlight multiple keywords separated by comma", () => {
      expect(highlightMatches("hello world programming", "hello,world")).toBe(
        "<mark>hello</mark> <mark>world</mark> programming",
      );
    });

    it("should handle empty search term", () => {
      expect(highlightMatches("hello world", "")).toBe("hello world");
    });

    it("should handle multiple occurrences", () => {
      expect(highlightMatches("data data science", "data")).toBe("<mark>data</mark> <mark>data</mark> science");
    });
  });

  describe("current behavior with special characters", () => {
    it("should not highlight across parentheses currently", () => {
      // These capture current behavior - should change after we implement the feature
      expect(highlightMatches("object-oriented programming", "object oriented")).toBe("object-oriented programming");
      expect(highlightMatches("data (structure) analysis", "data structure")).toBe("data (structure) analysis");
    });

    it("should not highlight across hyphens currently", () => {
      expect(highlightMatches("web-development course", "web development")).toBe("web-development course");
      expect(highlightMatches("real-time systems", "real time")).toBe("real-time systems");
    });

    it("should handle c++ literally", () => {
      expect(highlightMatches("c++ programming language", "c++")).toBe("<mark>c++</mark> programming language");
    });
  });

  describe.skip("future behavior with special characters (should pass after implementation)", () => {
    it("should highlight across parentheses and hyphens", () => {
      expect(highlightMatches("object-oriented programming", "object oriented")).toBe(
        "<mark>object-oriented</mark> programming",
      );
      expect(highlightMatches("data (structure) analysis", "data structure")).toBe(
        "<mark>data (structure)</mark> analysis",
      );
      expect(highlightMatches("web-development course", "web development")).toBe("<mark>web-development</mark> course");
      expect(highlightMatches("real-time systems", "real time")).toBe("<mark>real-time</mark> systems");
    });

    it("should still handle c++ literally", () => {
      expect(highlightMatches("c++ programming language", "c++")).toBe("<mark>c++</mark> programming language");
    });
  });

  describe("edge cases", () => {
    it("should escape regex special characters", () => {
      expect(highlightMatches("test (hello) world", "(hello)")).toBe("test <mark>(hello)</mark> world");
      expect(highlightMatches("c++ and c# programming", "c++")).toBe("<mark>c++</mark> and c# programming");
    });

    it("should handle overlapping matches", () => {
      expect(highlightMatches("javascript programming", "java,script")).toBe(
        "<mark>java</mark><mark>script</mark> programming",
      );
    });
  });
});

describe("highlightNumberPrefixes", () => {
  it("should highlight matching number prefix", () => {
    expect(highlightNumberPrefixes("CS101", ["cs"])).toBe("<mark>CS</mark>101");
    expect(highlightNumberPrefixes("MATH200", ["math"])).toBe("<mark>MATH</mark>200");
  });

  it("should handle case insensitive matching", () => {
    expect(highlightNumberPrefixes("cs101", ["CS"])).toBe("<mark>cs</mark>101");
  });

  it("should only highlight first matching prefix", () => {
    expect(highlightNumberPrefixes("CS101", ["c", "cs"])).toBe("<mark>C</mark>S101"); // matches 'c' first
  });

  it("should return original if no match", () => {
    expect(highlightNumberPrefixes("CS101", ["math"])).toBe("CS101");
  });

  it("should handle empty prefixes array", () => {
    expect(highlightNumberPrefixes("CS101", [])).toBe("CS101");
  });
});
