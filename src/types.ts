export interface CourseItem {
  id: string;
  title: string;
  description: string;
  instructor: string;
  terms: ("FA" | "JA" | "SP" | "SU")[];
  prereq: string;
  units: string;
  level: string;
}

export interface Query {
  title?: string;
  description?: string;
  semester?: string;
  prereq?: string;
  units?: string;
  level?: string;
  terms?: ("FA" | "JA" | "SP" | "SU")[];
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
}
