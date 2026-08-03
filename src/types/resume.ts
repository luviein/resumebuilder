// `basics` follows the JSON Resume schema (https://jsonresume.org/schema/). Everything else is
// a `sections[]` array instead of fixed named fields (work/education/skills/projects) — each
// section has a `title` (fully user-editable heading text) and a `type` that tells a template
// how to render its `items`. This is what makes arbitrary new sections (Certifications, Awards,
// Volunteer, ...) possible with zero code changes: they're just another section with a type a
// template already knows how to draw. Old resume.json files using the legacy work/education/
// skills/projects fields are migrated into this shape transparently — see migrateLegacySchema in
// ../lib/validate.ts.

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

/** A repeated dated item — a job, a degree, a project. `heading` is the primary name (company,
 * institution, project name); `subheading` is the secondary detail (position, degree, tagline). */
export interface ResumeEntryItem {
  heading: string;
  subheading?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
}

export interface ResumeSkillItem {
  name: string;
  level?: string;
  keywords?: string[];
}

export interface ResumeEntriesSection {
  title: string;
  type: "entries";
  items: ResumeEntryItem[];
}

export interface ResumeSkillsSection {
  title: string;
  type: "skills";
  items: ResumeSkillItem[];
}

/** Free prose — a single block of text under a heading (e.g. a custom "Publications" section). */
export interface ResumeTextSection {
  title: string;
  type: "text";
  items: string;
}

export type ResumeSection = ResumeEntriesSection | ResumeSkillsSection | ResumeTextSection;

export interface ResumeData {
  basics: ResumeBasics;
  sections: ResumeSection[];
}
