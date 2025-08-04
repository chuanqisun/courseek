export interface CourseItemRaw {
  title: string;
  description: string;
  instructor: string;
  semester: string;
  prereq: string;
  units: string;
}

export interface Query {
  title?: string;
  description?: string;
  semester?: string;
  prereq?: string;
  units?: string;
}
