export interface CourseItemRaw {
  title: string;
  description: string;
  instructor: string;
  semester: string;
  prereq: string;
  units: string;
  level: string;
}

export interface CourseItem {
  id: string;
  title: string;
  description: string;
  instructor: string;
  semesters: string[];
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
}
