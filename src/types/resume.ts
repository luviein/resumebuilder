// Based on the JSON Resume schema (https://jsonresume.org/schema/), with work entry fields
// renamed (name/position -> companyName/positionName) for clarity — this is a deliberate
// departure from the standard's field names, not a JSON-Resume-compatible file.
// Extra fields on a real resume.json are simply ignored, not rejected.

export interface ResumeLocation {
  address?: string;
  postalCode?: string;
  city?: string;
  region?: string;
  countryCode?: string;
}

export interface ResumeProfile {
  network?: string;
  username?: string;
  url?: string;
}

export interface ResumeBasics {
  name: string;
  label?: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
  location?: ResumeLocation;
  profiles?: ResumeProfile[];
}

export interface ResumeWork {
  companyName: string;
  positionName?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
}

export interface ResumeEducation {
  institution: string;
  area?: string;
  studyType?: string;
  startDate?: string;
  endDate?: string;
  score?: string;
  courses?: string[];
}

export interface ResumeSkill {
  name: string;
  level?: string;
  keywords?: string[];
}

export interface ResumeProject {
  name: string;
  description?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  highlights?: string[];
  keywords?: string[];
}

export interface ResumeData {
  basics: ResumeBasics;
  work?: ResumeWork[];
  education?: ResumeEducation[];
  skills?: ResumeSkill[];
  projects?: ResumeProject[];
}
