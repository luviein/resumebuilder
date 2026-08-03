import { describe, it, expect } from "vitest";
import { parseResumeText, EmptyResumeTextError } from "../src/lib/importers/heuristics";
import { validateResumeJson } from "../src/lib/validate";
import type { ResumeData, ResumeEntriesSection, ResumeSkillsSection } from "../src/types/resume";

function entriesSection(result: ResumeData, title: string): ResumeEntriesSection | undefined {
  const section = result.sections.find((s) => s.title === title);
  return section?.type === "entries" ? section : undefined;
}

function skillsSection(result: ResumeData, title: string): ResumeSkillsSection | undefined {
  const section = result.sections.find((s) => s.title === title);
  return section?.type === "skills" ? section : undefined;
}

const SAMPLE_RESUME_TEXT = `
Jordan Rivera
Senior Software Engineer
jordan.rivera@example.com | (555) 123-4567 | linkedin.com/in/jordanrivera | github.com/jrivera

SUMMARY
Backend-leaning engineer who enjoys shipping small, well-tested changes.

EXPERIENCE
Senior Software Engineer, Northwind Systems
Mar 2022 - Present
Own the payments processing service.
- Redesigned the retry pipeline, cutting tickets by 40%
- Mentored two junior engineers

Software Engineer, Bluefin Analytics
Jun 2019 - Feb 2022
- Shipped a self-serve dashboard

EDUCATION
University of Oregon
Sep 2015 - Jun 2019

SKILLS
TypeScript, Node.js, PostgreSQL, React
`;

describe("parseResumeText", () => {
  const result = parseResumeText(SAMPLE_RESUME_TEXT);

  it("extracts name and label from the header lines", () => {
    expect(result.basics.name).toBe("Jordan Rivera");
    expect(result.basics.label).toBe("Senior Software Engineer");
  });

  it("extracts contact info", () => {
    expect(result.basics.email).toBe("jordan.rivera@example.com");
    expect(result.basics.phone).toContain("555");
  });

  it("detects LinkedIn and GitHub profiles", () => {
    const networks = result.basics.profiles?.map((p) => p.network);
    expect(networks).toContain("LinkedIn");
    expect(networks).toContain("GitHub");
    expect(result.basics.profiles?.find((p) => p.network === "GitHub")?.url).toBe(
      "https://github.com/jrivera",
    );
  });

  it("captures the summary section", () => {
    expect(result.basics.summary).toMatch(/Backend-leaning engineer/);
  });

  it("splits experience into an Experience section with heading/subheading/dates/highlights", () => {
    const experience = entriesSection(result, "Experience");
    expect(experience?.items).toHaveLength(2);
    const [first, second] = experience!.items;

    expect(first.heading).toBe("Northwind Systems");
    expect(first.subheading).toBe("Senior Software Engineer");
    expect(first.startDate).toBe("2022-03");
    expect(first.endDate).toBe("");
    expect(first.highlights).toEqual([
      "Redesigned the retry pipeline, cutting tickets by 40%",
      "Mentored two junior engineers",
    ]);

    expect(second.heading).toBe("Bluefin Analytics");
    expect(second.startDate).toBe("2019-06");
    expect(second.endDate).toBe("2022-02");
  });

  it("extracts an Education section entry with dates", () => {
    const education = entriesSection(result, "Education");
    expect(education?.items).toHaveLength(1);
    expect(education!.items[0].heading).toBe("University of Oregon");
    expect(education!.items[0].startDate).toBe("2015-09");
    expect(education!.items[0].endDate).toBe("2019-06");
  });

  it("flattens the skills section into keywords", () => {
    const skills = skillsSection(result, "Skills");
    expect(skills?.items).toHaveLength(1);
    expect(skills!.items[0].keywords).toEqual(["TypeScript", "Node.js", "PostgreSQL", "React"]);
  });

  it("produces output that always passes validateResumeJson", () => {
    expect(validateResumeJson(JSON.stringify(result)).ok).toBe(true);
  });
});

describe("parseResumeText edge cases", () => {
  it("throws EmptyResumeTextError for near-empty input", () => {
    expect(() => parseResumeText("hi")).toThrow(EmptyResumeTextError);
  });

  it("falls back to a placeholder name and still validates when there's no clear header", () => {
    const result = parseResumeText("Some unstructured text with no name-like first line at all here");
    expect(result.basics.name.length).toBeGreaterThan(0);
    expect(validateResumeJson(JSON.stringify(result)).ok).toBe(true);
  });

  it("splits multiple entries correctly even with no blank lines at all (mammoth's docx output has none)", () => {
    // Every paragraph is its own line, mirroring mammoth.extractRawText — no blank-line signal
    // between entries at all, unlike PDF/plain-text extraction. Regression test: this used to
    // either merge everything into one entry (PDF path, blank lines stripped) or fragment every
    // single line into its own entry (docx path, blank line between every paragraph).
    const text = [
      "Morgan Lee",
      "Data Analyst",
      "morgan.lee@example.com",
      "EXPERIENCE",
      "Data Analyst, Globex Inc",
      "Feb 2020 - Dec 2023",
      "- Built a churn dashboard used by 5 teams",
      "UX Researcher, Prior Co",
      "Jan 2017 - Jan 2020",
      "- Ran 40+ user interviews",
      "EDUCATION",
      "Lakeside College",
      "Sep 2016 - May 2020",
    ].join("\n");

    const result = parseResumeText(text);

    const experience = entriesSection(result, "Experience");
    expect(experience?.items).toHaveLength(2);
    expect(experience!.items[0].heading).toBe("Globex Inc");
    expect(experience!.items[0].highlights).toEqual(["Built a churn dashboard used by 5 teams"]);
    expect(experience!.items[1].heading).toBe("Prior Co");
    expect(experience!.items[1].startDate).toBe("2017-01");

    const education = entriesSection(result, "Education");
    expect(education?.items).toHaveLength(1);
    expect(education!.items[0].heading).toBe("Lakeside College");
  });

  it("recognizes a pluralized section header ('EXPERIENCES')", () => {
    const text = [
      "Sam Rivera",
      "SKILLS",
      "Python, SQL",
      "EXPERIENCES",
      "Software Engineer, Visa",
      "Feb 2024 - Present",
      "- Shipped a schema validation tool",
    ].join("\n");

    const result = parseResumeText(text);

    const skills = skillsSection(result, "Skills");
    expect(skills?.items).toHaveLength(1);
    expect(skills!.items[0].keywords).toEqual(["Python", "SQL"]);

    const experience = entriesSection(result, "Experience");
    expect(experience?.items).toHaveLength(1);
    expect(experience!.items[0].heading).toBe("Visa");
  });

  it("recovers content trapped on the same line as a merged section header", () => {
    // Extracted text sometimes runs a header straight into the next line's content with no gap
    // (a real PDF extraction artifact) — the header keyword should still be recognized and
    // whatever follows it on that line should land in the new section, not get discarded.
    const text = [
      "Sam Rivera",
      "SKILLS",
      "Python, SQL",
      "EXPERIENCE Software Engineer, Visa",
      "Feb 2024 - Present",
      "- Shipped a schema validation tool",
    ].join("\n");

    const result = parseResumeText(text);

    const skills = skillsSection(result, "Skills");
    expect(skills?.items).toHaveLength(1);
    expect(skills!.items[0].keywords).toEqual(["Python", "SQL"]);

    const experience = entriesSection(result, "Experience");
    expect(experience?.items).toHaveLength(1);
    expect(experience!.items[0].heading).toBe("Visa");
  });

  it("reads 'Company | Position' headers correctly, not just 'Position, Company'", () => {
    // The separator alone is ambiguous — "Visa | Software Engineer" is company-first, unlike the
    // comma convention used elsewhere ("Data Analyst, Globex Inc" is position-first). Regression
    // test: this used to always assume position-first regardless of separator, swapping the two.
    const text = [
      "Yen Leng Tan",
      "EXPERIENCE",
      "Visa | Software Engineer",
      "Feb 2024 - Present",
      "- Shipped a schema validation tool",
    ].join("\n");

    const result = parseResumeText(text);

    const experience = entriesSection(result, "Experience");
    expect(experience?.items).toHaveLength(1);
    expect(experience!.items[0].heading).toBe("Visa");
    expect(experience!.items[0].subheading).toBe("Software Engineer");
  });

  it("splits a bullet-less entry body into multiple highlights instead of one dense paragraph", () => {
    // Some PDF exports draw bullets as vector graphics with no text character at all, so nothing
    // matches BULLET_RE and the whole entry body used to collapse into one run-on summary string.
    const text = [
      "Yen Leng Tan",
      "EXPERIENCE",
      "Visa | Software Engineer",
      "Feb 2024 - Present",
      "Owned end-to-end frontend features. Leveraged LLMs for agentic development. Partnered across teams to align schemas.",
    ].join("\n");

    const result = parseResumeText(text);
    const experience = entriesSection(result, "Experience");

    expect(experience!.items[0].summary).toBeUndefined();
    expect(experience!.items[0].highlights).toEqual([
      "Owned end-to-end frontend features.",
      "Leveraged LLMs for agentic development.",
      "Partnered across teams to align schemas.",
    ]);
  });

  it("doesn't mistake a wrapped bullet's continuation line for a new entry header", () => {
    // Real PDF bullets often wrap across two physical lines with no bullet character on the
    // continuation line ("...improving visibility and" / "reducing sprint tracking effort by
    // 85%."). Regression test: the continuation line used to get misread as the next job's
    // header just because a date happened to follow it soon after, truncating the real sentence
    // and swallowing the real header ("Visa | Associate Test Engineer") into a bullet instead.
    const text = [
      "Yen Leng Tan",
      "EXPERIENCE",
      "Visa | Software Engineer",
      "Feb 2026 - Jul 2026",
      "Engineered an automated Jira script fetching live bugs, improving visibility and",
      "reducing sprint tracking effort by 85%.",
      "Visa | Associate Test Engineer",
      "Apr 2024 - Feb 2026",
      "Expanded scope in 2025 to take on frontend development.",
    ].join("\n");

    const result = parseResumeText(text);
    const experience = entriesSection(result, "Experience");

    expect(experience?.items).toHaveLength(2);
    expect(experience!.items[0].heading).toBe("Visa");
    expect(experience!.items[0].subheading).toBe("Software Engineer");
    expect(experience!.items[0].highlights).toEqual([
      "Engineered an automated Jira script fetching live bugs, improving visibility and reducing sprint tracking effort by 85%.",
    ]);

    expect(experience!.items[1].heading).toBe("Visa");
    expect(experience!.items[1].subheading).toBe("Associate Test Engineer");
    expect(experience!.items[1].startDate).toBe("2024-04");
  });

  it("recognizes an unrecognized ALL-CAPS heading (e.g. Certifications) as its own text section", () => {
    // No keyword vocabulary for "CERTIFICATIONS" exists — it should still become a real section
    // instead of being silently absorbed into whatever section came before it.
    const text = [
      "Sam Rivera",
      "SKILLS",
      "Python, SQL",
      "LANGUAGES",
      "English, Spanish, French",
    ].join("\n");

    const result = parseResumeText(text);
    const languages = result.sections.find((s) => s.title === "Languages");
    expect(languages?.type).toBe("text");
    if (languages?.type === "text") {
      expect(languages.items).toBe("English, Spanish, French");
    }
  });

  it("infers an 'entries' type for an unrecognized heading whose content looks like dated entries", () => {
    const text = [
      "Sam Rivera",
      "CERTIFICATIONS",
      "AWS Certified Solutions Architect",
      "Jan 2023 - Present",
    ].join("\n");

    const result = parseResumeText(text);
    const certifications = entriesSection(result, "Certifications");
    expect(certifications?.items).toHaveLength(1);
    expect(certifications!.items[0].heading).toBe("AWS Certified Solutions Architect");
    expect(certifications!.items[0].startDate).toBe("2023-01");
    expect(certifications!.items[0].endDate).toBe("");
  });

  // Real raw pdf.js output (PII anonymized) from a resume where every job header is written as
  // ONE combined "Company | Position | DateRange" line, rather than header-then-separate-date-line.
  // Regression test: the combined-header pattern used to get silently absorbed as a bullet of the
  // PREVIOUS entry instead of starting a new one, because splitIntoEntries only knew how to detect
  // a header that was immediately followed by a *separate* pure-date line.
  const REAL_WORLD_RESUME_TEXT = `Alex Rivera
Soware Engineer
+1 555 123 4567 | alex.rivera@example.com | linkedin.com/in/alexrivera | github.com/arivera
TECHNICAL SKILLS
Languages: JavaScript, TypeScript, Python, Java, HTML, CSS, SQL
Frameworks & Concepts: Spring Boot, Angular, React, REST APIs, OAuth 2.0, Cypress, Android, Git, Jira
EXPERIENCES
Visa | Soware Engineer | Feb 2026 – Jul 2026
Owned end-to-end frontend feature implementations for the internal enterprise Client Configuration Management (CCM) platform,
building responsive UI components and integrating backend REST APIs.
Leveraged LLMs for agentic soware development, authoring modular AI "skills" and reusable prompt frameworks to accelerate feature
prototyping and streamline developer workflows.
Partnered closely across multi-regional product, engineering, and QA teams in the US and EU to define API contracts, align schemas, and
deploy global platform updates.
Scripted an AI-powered PR filtering tool using Claude Sonnet 4.6 to evaluate and triage incoming QA pull requests, accelerating code
merge speed by 80%.
Developed an automated schema validation script using Claude API that detects outdated configuration schemas and auto-generates pull
requests for review, reducing manual config audit time by 75%.
Engineered an automated Jira observability script fetching live bugs and scope changes in minutes, improving release risk visibility and
reducing sprint tracking effort by 85%.
Visa | Associate Test Engineer | Apr 2024 – Feb 2026
Expanded scope in 2025 to take on frontend development, building UI components and integrating REST APIs to deliver a dynamic financial
modeling module and advanced configuration workflows alongside core QA responsibilities.
Designed and maintained robust end-to-end automated regression test suites using Cypress to validate critical web application flows and
payment features.
Executed functional regression testing, collaborating directly with cross-functional engineering teams to diagnose root causes and
resolve production defects.
Recognized for strong development execution and technical initiative, earning a promotion to full-time Soware Engineer.
Visa | Test Engineer Trainee | Apr 2023 – Apr 2024
Engineered "Learntopia," a full-stack gamified learning application (Java, Spring Boot, Angular) integrating Google OAuth, external REST
APIs, and a Python-based Telegram chatbot for interactive math practice, successfully presented to a faculty panel to culminate the
traineeship.
Mastered soware testing methodologies, manual test execution, and modern test automation practices across enterprise release cycles.
Successfully converted into a full-time Associate Test Engineer role upon completion of the 12-month Technology Traineeship.
EDUCATION
Example University
Bachelor of Information Technology | Admitted for Aug 2026 (Studies Deferred)
Example Institute of Systems Science
Professional Diploma in Soware Development | Apr 2023 – Apr 2024
Sample University
Bachelor in Accountancy | Jul 2019 – Jul 2021`;

  it("correctly splits three jobs that each use a single combined 'Company | Position | Date' header line", () => {
    const result = parseResumeText(REAL_WORLD_RESUME_TEXT);
    const experience = entriesSection(result, "Experience");

    expect(experience?.items).toHaveLength(3);
    const [job1, job2, job3] = experience!.items;

    expect(job1.heading).toBe("Visa");
    expect(job1.subheading).toBe("Soware Engineer");
    expect(job1.startDate).toBe("2026-02");
    expect(job1.endDate).toBe("2026-07");
    expect(job1.highlights).toHaveLength(6);
    expect(job1.highlights![0]).toMatch(/^Owned end-to-end frontend feature implementations/);
    expect(job1.highlights![5]).toBe(
      "Engineered an automated Jira observability script fetching live bugs and scope changes in minutes, improving release risk visibility and reducing sprint tracking effort by 85%.",
    );
    // The wrongly-split fragment must not appear as its own entry, and the real header must not
    // leak into a bullet of the wrong entry.
    expect(experience!.items.some((w) => /^reducing sprint tracking/.test(w.heading))).toBe(false);

    expect(job2.heading).toBe("Visa");
    expect(job2.subheading).toBe("Associate Test Engineer");
    expect(job2.startDate).toBe("2024-04");
    expect(job2.endDate).toBe("2026-02");
    expect(job2.highlights!.some((h) => h.startsWith("Visa |"))).toBe(false);
    expect(job2.highlights![0]).toMatch(/^Expanded scope in 2025/);

    expect(job3.heading).toBe("Visa");
    expect(job3.subheading).toBe("Test Engineer Trainee");
    expect(job3.startDate).toBe("2023-04");
    expect(job3.endDate).toBe("2024-04");
    expect(job3.highlights!.some((h) => h.startsWith("Visa |"))).toBe(false);
  });

  it("splits education entries correctly even when one entry has no parseable date", () => {
    // "Admitted for Aug 2026 (Studies Deferred)" isn't a date *range*, so the first education
    // entry never sets currentHasDate — regression test that this doesn't wedge the parser into
    // merging every remaining education entry into one.
    const result = parseResumeText(REAL_WORLD_RESUME_TEXT);
    const education = entriesSection(result, "Education");

    expect(education?.items).toHaveLength(3);
    const [edu1, edu2, edu3] = education!.items;

    expect(edu1.heading).toBe("Example University");
    expect(edu1.subheading).toBe("Bachelor of Information Technology");
    // No real date range for this one — the non-range trailing text ("Admitted for Aug 2026
    // (Studies Deferred)") should still surface as the date note rather than being dropped.
    expect(edu1.startDate).toBe("Admitted for Aug 2026 (Studies Deferred)");
    expect(edu1.endDate).toBeUndefined();

    expect(edu2.heading).toBe("Example Institute of Systems Science");
    expect(edu2.subheading).toBe("Professional Diploma in Soware Development");
    expect(edu2.startDate).toBe("2023-04");
    expect(edu2.endDate).toBe("2024-04");

    expect(edu3.heading).toBe("Sample University");
    expect(edu3.subheading).toBe("Bachelor in Accountancy");
    expect(edu3.startDate).toBe("2019-07");
    expect(edu3.endDate).toBe("2021-07");
  });
});
