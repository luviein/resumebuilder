import type { ResumeData, ResumeWork, ResumeEducation, ResumeProject } from "../../types/resume";
import { escapeHtml } from "../../lib/escapeHtml";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Formats "YYYY-MM" or "YYYY-MM-DD" as "Mon YYYY"; passes through anything else unchanged. */
function formatDate(value: string | undefined): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) return escapeHtml(value);
  const [, year, month] = match;
  const monthName = MONTHS[Number(month) - 1];
  return monthName ? `${monthName} ${year}` : escapeHtml(value);
}

/**
 * `endDate: undefined` means "no end field at all" (e.g. a status note like "Admitted for Aug
 * 2026", not a range) — show the start value alone. `endDate: ""` means "ongoing" — show "– Present".
 * `endDate` with a value shows a normal range.
 */
function dateRange(startDate: string | undefined, endDate: string | undefined): string {
  const start = formatDate(startDate);
  if (!start) return "";
  if (endDate === undefined) return start;
  const end = endDate ? formatDate(endDate) : "Present";
  return `${start} – ${end}`;
}

function renderHighlights(highlights: string[] | undefined): string {
  if (!highlights || highlights.length === 0) return "";
  const items = highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join("");
  return `<ul class="highlights">${items}</ul>`;
}

function renderWorkEntry(entry: ResumeWork): string {
  return `
    <article class="entry">
      <div class="entry-header">
        <h3>${escapeHtml(entry.positionName)}${entry.positionName && entry.companyName ? ", " : ""}${escapeHtml(entry.companyName)}</h3>
        <span class="entry-dates">${dateRange(entry.startDate, entry.endDate)}</span>
      </div>
      ${entry.summary ? `<p class="entry-summary">${escapeHtml(entry.summary)}</p>` : ""}
      ${renderHighlights(entry.highlights)}
    </article>
  `;
}

function renderEducationEntry(entry: ResumeEducation): string {
  const degree = [entry.studyType, entry.area].filter(Boolean).map(escapeHtml).join(", ");
  return `
    <article class="entry">
      <div class="entry-header">
        <h3>${escapeHtml(entry.institution)}</h3>
        <span class="entry-dates">${dateRange(entry.startDate, entry.endDate)}</span>
      </div>
      ${degree ? `<p class="entry-summary">${degree}</p>` : ""}
    </article>
  `;
}

function renderProjectEntry(entry: ResumeProject): string {
  return `
    <article class="entry">
      <div class="entry-header">
        <h3>${escapeHtml(entry.name)}</h3>
        <span class="entry-dates">${dateRange(entry.startDate, entry.endDate)}</span>
      </div>
      ${entry.description ? `<p class="entry-summary">${escapeHtml(entry.description)}</p>` : ""}
      ${renderHighlights(entry.highlights)}
    </article>
  `;
}

export function renderMinimal(resume: ResumeData): string {
  const { basics } = resume;
  const locationParts = basics.location
    ? [basics.location.city, basics.location.region, basics.location.countryCode].filter(Boolean)
    : [];

  const contactLine = [
    basics.email,
    basics.phone,
    basics.url,
    locationParts.length ? locationParts.join(", ") : undefined,
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" · ");

  const profilesLine = (basics.profiles ?? [])
    .filter((p) => p.url)
    .map((p) => `<a href="${escapeHtml(p.url)}">${escapeHtml(p.network ?? p.url)}</a>`)
    .join(" · ");

  return `
    <header class="resume-header">
      <h1>${escapeHtml(basics.name)}</h1>
      ${basics.label ? `<p class="label">${escapeHtml(basics.label)}</p>` : ""}
      ${contactLine ? `<p class="contact">${contactLine}</p>` : ""}
      ${profilesLine ? `<p class="contact">${profilesLine}</p>` : ""}
    </header>

    ${basics.summary ? `<section><h2>Summary</h2><p>${escapeHtml(basics.summary)}</p></section>` : ""}

    ${resume.work?.length ? `<section><h2>Experience</h2>${resume.work.map(renderWorkEntry).join("")}</section>` : ""}

    ${resume.education?.length ? `<section><h2>Education</h2>${resume.education.map(renderEducationEntry).join("")}</section>` : ""}

    ${resume.projects?.length ? `<section><h2>Projects</h2>${resume.projects.map(renderProjectEntry).join("")}</section>` : ""}

    ${resume.skills?.length ? `
      <section>
        <h2>Skills</h2>
        <ul class="skills">
          ${resume.skills.map((s) => `<li><strong>${escapeHtml(s.name)}:</strong> ${escapeHtml((s.keywords ?? []).join(", "))}</li>`).join("")}
        </ul>
      </section>
    ` : ""}
  `;
}
