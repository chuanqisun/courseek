export interface WorkerResponseData {
  results: SearchableCourse[];
  lastUpdated: string;
}

export interface CourseItem {
  id: string;
  title: string;
  description: string;
  instructor: string;
  terms: ("FA" | "JA" | "SP" | "SU")[];
  prereq: string;
  units: [lecture: number, lab: number, prep: number];
  level: string;
  hours: number;
  rating: number;
  size: number;
  half: boolean;
  final: boolean;
}

// Enhanced search result interface
export interface SearchableCourse extends CourseItem {
  score: number;
  titleHTML: string;
  descriptionHTML: string;
  courseIdHTML: string;
  instructorHTML: string;
}

export interface UnitsFilter {
  minUnits?: number;
  maxUnits?: number;
  minLectureUnits?: number;
  maxLectureUnits?: number;
  minLabUnits?: number;
  maxLabUnits?: number;
  minPrepUnits?: number;
  maxPrepUnits?: number;
  minHours?: number;
  maxHours?: number;
  minSize?: number;
  maxSize?: number;
  minRating?: number;
  maxRating?: number;
}

export interface Query {
  keywords?: string;
  numbers?: string;
  semester?: string;
  noPrereq?: boolean;
  halfTerm?: boolean;
  noFinal?: boolean;
  minUnits?: number;
  maxUnits?: number;
  minLectureUnits?: number;
  maxLectureUnits?: number;
  minLabUnits?: number;
  maxLabUnits?: number;
  minPrepUnits?: number;
  maxPrepUnits?: number;
  minHours?: number;
  maxHours?: number;
  minSize?: number;
  maxSize?: number;
  minRating?: number;
  maxRating?: number;
  level?: string;
  terms?: ("FA" | "JA" | "SP" | "SU")[];
  sort?: "relevance" | "rating" | "hours" | "size" | "number";
  sortDirection?: "high" | "low" | "long" | "short" | "large" | "small";
  requireEval?: boolean;
}

export interface HydrantRaw {
  termInfo: any;
  lastUpdated: string;
  classes: Record<string, HydrantItemRaw>;
}

export interface HydrantItemRaw {
  name: string;
  description: string;
  number: string;
  terms: ("FA" | "JA" | "SP" | "SU")[];
  prereqs: string;
  level: string;
  inCharge: string;
  labUnits?: number;
  lectureUnits?: number;
  preparationUnits?: number;
  rating: number;
  hours: number;
  size: number;
  half: boolean /** is half term */;
  final: boolean /** has final exam */;
}
