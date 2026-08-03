import type { ResumeData, ResumeSection, ResumeEntryItem, ResumeSkillItem } from "../../types/resume";
import { escapeHtml } from "../../lib/escapeHtml";
import { markupToHtml } from "../../lib/inlineMarkup";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

/** Prose fields (summary, highlight bullets, text sections) support bold/italic markup and are
 * individually addressable via a data-path attribute, so the floating format toolbar can write
 * an edit back to the exact JSON field it came from. */
function editableAttrs(path: string): string {
  return `contenteditable="true" data-path="${path}"`;
}

function renderHighlights(highlights: string[] | undefined, basePath: string): string {
  if (!highlights || highlights.length === 0) return "";
  const items = highlights
    .map((h, i) => `<li ${editableAttrs(`${basePath}.highlights.${i}`)}>${markupToHtml(h)}</li>`)
    .join("");
  return `<ul class="highlights">${items}</ul>`;
}

function renderEntryItem(entry: ResumeEntryItem, basePath: string): string {
  const heading = escapeHtml(entry.heading);
  const subheading = entry.subheading ? escapeHtml(entry.subheading) : "";
  return `
    <article class="entry">
      <div class="entry-header">
        <h3>${subheading}${subheading && heading ? ", " : ""}${heading}</h3>
        <span class="entry-dates">${dateRange(entry.startDate, entry.endDate)}</span>
      </div>
      ${entry.summary ? `<p class="entry-summary" ${editableAttrs(`${basePath}.summary`)}>${markupToHtml(entry.summary)}</p>` : ""}
      ${renderHighlights(entry.highlights, basePath)}
    </article>
  `;
}

function renderSkillItem(skill: ResumeSkillItem): string {
  const keywords = (skill.keywords ?? []).join(", ");
  return `<li><strong>${escapeHtml(skill.name)}:</strong> ${escapeHtml(keywords)}</li>`;
}

function renderSection(section: ResumeSection, index: number): string {
  const title = escapeHtml(section.title);
  const basePath = `sections.${index}`;
  if (section.type === "entries") {
    if (!section.items.length) return "";
    const items = section.items.map((item, i) => renderEntryItem(item, `${basePath}.items.${i}`)).join("");
    return `<section><h2>${title}</h2>${items}</section>`;
  }
  if (section.type === "skills") {
    if (!section.items.length) return "";
    return `<section><h2>${title}</h2><ul class="skills">${section.items.map(renderSkillItem).join("")}</ul></section>`;
  }
  if (!section.items.trim()) return "";
  return `<section><h2>${title}</h2><p ${editableAttrs(`${basePath}.items`)}>${markupToHtml(section.items)}</p></section>`;
}

/**
 * Structural renderer shared by every template: header from `basics`, then each `sections[]`
 * entry dispatched by its `type`. Templates differ only in the CSS that styles this same markup
 * (single column throughout — multi-column layouts confuse ATS text extraction) — a template
 * that wants a genuinely different structure can still implement `Template.render` on its own
 * against the same `ResumeData` shape instead of using this.
 */
export function renderResume(resume: ResumeData): string {
  const { basics } = resume;
  const location = basics.location;
  const hasCityOrRegion = Boolean(location?.city || location?.region);
  // A bare country code with no city/region reads as a phone dialing code, not a location — show
  // it next to the phone number instead of as its own floating contact-line item. When there's a
  // real city/region alongside it, it's genuinely a location (e.g. "Portland, OR, US") and stays
  // grouped there as before. If there's no phone to attach to, fall back to showing it as a
  // location fragment rather than losing it.
  const attachCountryCodeToPhone = Boolean(location?.countryCode) && !hasCityOrRegion && Boolean(basics.phone);

  const locationParts = location
    ? [location.city, location.region, attachCountryCodeToPhone ? undefined : location.countryCode].filter(Boolean)
    : [];

  const phoneDisplay = basics.phone
    ? attachCountryCodeToPhone
      ? `+${location!.countryCode} ${basics.phone}`
      : basics.phone
    : undefined;

  const contactLine = [
    basics.email,
    phoneDisplay,
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

    ${basics.summary ? `<section><h2>Summary</h2><p ${editableAttrs("basics.summary")}>${markupToHtml(basics.summary)}</p></section>` : ""}

    ${resume.sections.map((s, i) => renderSection(s, i)).join("")}
  `;
}
