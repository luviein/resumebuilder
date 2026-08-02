import type {
  ResumeData,
  ResumeBasics,
  ResumeWork,
  ResumeEducation,
  ResumeSkill,
  ResumeProject,
  ResumeProfile,
} from "../../types/resume";

const MIN_TEXT_LENGTH = 20;

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_RE = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
const URL_RE = /(https?:\/\/[^\s,)]+|www\.[^\s,)]+)/i;
const BULLET_RE = /^[•\-*‣·○◦]\s*/;

const MONTH_ABBR = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_PATTERN = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*";
const DATE_RANGE_RE = new RegExp(
  `(${MONTH_PATTERN}\\.?\\s+\\d{4}|\\d{4})\\s*(?:-|–|—|to)\\s*(${MONTH_PATTERN}\\.?\\s+\\d{4}|\\d{4}|Present|Current|Now)`,
  "i",
);

type SectionKey = "summary" | "work" | "education" | "skills" | "projects";

const SECTION_KEYWORDS: Record<SectionKey, string[]> = {
  summary: ["summary", "objective", "profile", "about"],
  work: ["experience", "work experience", "employment", "work history", "professional experience"],
  education: ["education"],
  skills: ["skills", "technical skills", "core competencies"],
  projects: ["projects", "personal projects"],
};

/** Thrown when the extracted text is too sparse to be worth heuristically parsing (e.g. a scanned/image-only PDF). */
export class EmptyResumeTextError extends Error {}

/**
 * Detects a section header at the START of a line rather than requiring the whole line to match.
 * Extracted PDF text sometimes runs a header straight into the following content with little or
 * no gap (e.g. "EXPERIENCEVisa | Software Engineer..."), and headers are sometimes pluralized
 * ("EXPERIENCES") — both are tolerated here. Whatever follows the matched keyword on the same
 * line is returned as `rest` so it isn't silently dropped.
 */
function matchSectionHeader(line: string): { key: SectionKey; rest: string } | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;

  for (const key of Object.keys(SECTION_KEYWORDS) as SectionKey[]) {
    for (const keyword of SECTION_KEYWORDS[key]) {
      const re = new RegExp(`^${keyword}s?\\b:?\\s*`, "i");
      const match = re.exec(trimmed);
      if (match && match[0].trim().length <= 25) {
        return { key, rest: trimmed.slice(match[0].length).trim() };
      }
    }
  }
  return null;
}

function isContactLine(line: string): boolean {
  return EMAIL_RE.test(line) || PHONE_RE.test(line) || URL_RE.test(line);
}

function splitIntoSections(lines: string[]): { header: string[]; sections: Partial<Record<SectionKey, string[]>> } {
  const sections: Partial<Record<SectionKey, string[]>> = {};
  let currentKey: SectionKey | null = null;
  const header: string[] = [];

  for (const line of lines) {
    const match = matchSectionHeader(line);
    if (match) {
      currentKey = match.key;
      if (!sections[match.key]) sections[match.key] = [];
      if (match.rest) sections[match.key]!.push(match.rest);
      continue;
    }
    if (currentKey) {
      sections[currentKey]!.push(line);
    } else {
      header.push(line);
    }
  }
  return { header, sections };
}

/**
 * A wrapped continuation of a bullet/sentence (the tail end of a long line that spilled onto the
 * next physical line, with no bullet character of its own) — as opposed to a genuine new entry
 * header. Company names and job titles are essentially never lowercase-first ("reducing sprint
 * tracking effort by 85%." is a wrapped sentence tail, not a header); this is a cheap, reliable tell.
 */
function looksLikeWrappedContinuation(line: string): boolean {
  return /^[a-z]/.test(line);
}

/** True if the ENTIRE line is just a date range with nothing else on it (vs. a date embedded in a longer header line). */
function isPureDateLine(line: string): boolean {
  if (!DATE_RANGE_RE.test(line)) return false;
  return extractDateRange(line).remainder.length === 0;
}

/** A short, title-case-ish line with no date of its own — plausibly a bare institution/company name line. */
function looksLikeBareTitleLine(line: string): boolean {
  return line.length <= 80 && !looksLikeWrappedContinuation(line) && !DATE_RANGE_RE.test(line);
}

/**
 * Splits a section's lines into individual entries (jobs, degrees, projects). Extracted text
 * doesn't reliably preserve blank-line spacing between entries — pdf.js drops it entirely, and
 * mammoth's raw text inserts a blank line between *every* paragraph, so neither source can be
 * split on blank lines alone. Three header conventions all anchor on date-range lines, and need
 * to be told apart since they conflict if treated the same:
 *   1. Header on its own line, followed by a separate pure-date line ("Company\nMar 2022 - Present").
 *   2. Header and date combined on one line ("Company | Position | Mar 2022 - Present").
 *   3. Bare name line, then a second line with more detail *and* the date combined
 *      ("Example University\nBachelor's | Mar 2022 - Present") — the date-bearing line isn't a pure
 *      date line (case 1) and doesn't want to steal the date for whatever candidate came right
 *      before it (case 2's rule would misfire here), so the preceding bare line is pulled forward
 *      into the new entry instead of staying attached to the old one.
 */
function splitIntoEntries(lines: string[]): string[][] {
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  const chunks: string[][] = [];
  let current: string[] = [];

  const startsNewEntrySoon = (fromIdx: number): boolean => {
    for (let j = fromIdx; j < nonEmpty.length; j++) {
      if (BULLET_RE.test(nonEmpty[j])) continue;
      return isPureDateLine(nonEmpty[j]);
    }
    return false;
  };

  for (let i = 0; i < nonEmpty.length; i++) {
    const line = nonEmpty[i];
    const isBullet = BULLET_RE.test(line);
    const hasDate = !isBullet && DATE_RANGE_RE.test(line);
    const isContinuation = looksLikeWrappedContinuation(line);
    // This line is itself a complete "Header | ... | Date" line, not a bare date (case 2 or 3).
    const isSelfContainedHeader = hasDate && !isPureDateLine(line);

    const startsNewEntry =
      current.length > 0 &&
      !isBullet &&
      !isContinuation &&
      (isSelfContainedHeader || (!hasDate && startsNewEntrySoon(i + 1)));

    if (startsNewEntry) {
      let newChunk = [line];
      // Case 3: the immediately preceding line might be this entry's bare name, mistakenly left
      // behind in the old chunk — reclaim it if it looks like a plausible bare title line.
      if (isSelfContainedHeader && current.length > 0 && looksLikeBareTitleLine(current[current.length - 1])) {
        newChunk = [current.pop()!, line];
      }
      if (current.length) chunks.push(current);
      current = newChunk;
      continue;
    }

    current.push(line);
  }

  if (current.length) chunks.push(current);
  return chunks;
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.replace(/[.,;)]+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

interface ContactInfo {
  email?: string;
  phone?: string;
  url?: string;
  profiles: ResumeProfile[];
}

function extractContactInfo(text: string): ContactInfo {
  const email = EMAIL_RE.exec(text)?.[0];
  const phone = PHONE_RE.exec(text)?.[0];

  const profiles: ResumeProfile[] = [];
  const linkedinMatch = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s,)]+/i.exec(text);
  if (linkedinMatch) profiles.push({ network: "LinkedIn", url: normalizeUrl(linkedinMatch[0]) });

  const githubMatch = /(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s,)]+/i.exec(text);
  if (githubMatch) profiles.push({ network: "GitHub", url: normalizeUrl(githubMatch[0]) });

  const allUrls = text.match(/(https?:\/\/[^\s,)]+|www\.[^\s,)]+)/gi) ?? [];
  const personalUrl = allUrls.map(normalizeUrl).find((u) => !/linkedin\.com|github\.com/i.test(u));

  return { email, phone, url: personalUrl, profiles };
}

function normalizeDate(token: string): string {
  if (/present|current|now/i.test(token)) return "";
  const withMonth = /^([A-Za-z]+)\.?\s+(\d{4})$/.exec(token.trim());
  if (!withMonth) {
    const yearOnly = /^(\d{4})$/.exec(token.trim());
    return yearOnly ? yearOnly[1] : token.trim();
  }
  const [, monthName, year] = withMonth;
  const idx = MONTH_ABBR.findIndex((abbr) => monthName.toLowerCase().startsWith(abbr));
  return idx === -1 ? year : `${year}-${String(idx + 1).padStart(2, "0")}`;
}

function extractDateRange(text: string): { start?: string; end?: string; remainder: string } {
  const match = DATE_RANGE_RE.exec(text);
  if (!match) return { remainder: text.trim() };
  const start = normalizeDate(match[1]);
  const end = normalizeDate(match[2]);
  // Whitespace can sit between the leftover text and the separator punctuation (e.g. "Visa | Engineer | "
  // after the date is removed), so strip whitespace and punctuation together, not as separate passes.
  const remainder = (text.slice(0, match.index) + text.slice(match.index + match[0].length))
    .replace(/[\s,\-–—|]+$/, "")
    .replace(/^[\s,\-–—|]+/, "")
    .trim();
  return { start, end, remainder };
}

function stripBullet(line: string): string | null {
  return BULLET_RE.test(line) ? line.replace(BULLET_RE, "").trim() : null;
}

interface ParsedEntryBody {
  start?: string;
  end?: string;
  headerText: string;
  highlights: string[];
  bodyLines: string[];
}

/** Parses one blank-line-delimited chunk into a date range, a header line, bullets, and leftover body text. */
function parseEntryBody(chunk: string[]): ParsedEntryBody {
  let start: string | undefined;
  let end: string | undefined;
  let headerText = "";
  let headerSet = false;
  const highlights: string[] = [];
  const bodyLines: string[] = [];

  for (const rawLine of chunk) {
    const bullet = stripBullet(rawLine);
    const isBullet = bullet !== null;
    const { start: s, end: e, remainder } = extractDateRange(isBullet ? bullet! : rawLine);
    if (s && !start) {
      start = s;
      end = e;
    }
    if (!remainder) continue;
    if (isBullet) {
      highlights.push(remainder);
    } else if (!headerSet) {
      headerText = remainder;
      headerSet = true;
    } else {
      bodyLines.push(remainder);
    }
  }

  return { start, end, headerText, highlights, bodyLines };
}

const JOB_TITLE_KEYWORDS =
  /\b(engineer|manager|director|analyst|designer|developer|lead|specialist|consultant|coordinator|associate|intern|architect|scientist|officer|president|vp|executive|administrator|technician|representative|strategist|producer|researcher|trainee)\b/i;

/**
 * Splits a "Position, Company" / "Company | Position" style header into its two parts. The
 * separator alone doesn't tell you the order — resumes vary ("Position at Company" is always
 * position-first, but "|" and "-" are used both ways) — so this looks for job-title vocabulary in
 * each half first, and only falls back to a fixed convention per separator when that's inconclusive.
 */
function splitHeader(header: string): { position?: string; company?: string } {
  const separators = [" at ", " @ ", " | ", " – ", " — ", " - ", ", "];
  for (const sep of separators) {
    if (!header.includes(sep)) continue;
    const idx = header.indexOf(sep);
    const left = header.slice(0, idx).trim();
    const right = header.slice(idx + sep.length).trim();
    if (!left || !right) continue;

    const leftIsTitle = JOB_TITLE_KEYWORDS.test(left);
    const rightIsTitle = JOB_TITLE_KEYWORDS.test(right);
    if (leftIsTitle && !rightIsTitle) return { position: left, company: right };
    if (rightIsTitle && !leftIsTitle) return { position: right, company: left };

    // Inconclusive — fall back to convention: "at"/"," read position-first, "|"/dash read company-first.
    if (sep === " at " || sep === " @ " || sep === ", ") return { position: left, company: right };
    return { company: left, position: right };
  }
  return { company: header || undefined };
}

/** Splits on sentence boundaries — used as a highlights fallback when no bullet characters were found at all. */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Some PDF exports (notably design tools like Canva) draw bullet dots as vector graphics rather
 * than text characters, so the extracted lines have no leading bullet glyph at all to detect —
 * everything ends up as one run-on paragraph. When that happens (no bullets were found, but there
 * is body text), fall back to sentence-splitting so it at least reads as separate points instead
 * of a wall of text.
 */
function highlightsAndBody(highlights: string[], bodyLines: string[]): { highlights?: string[]; body?: string } {
  const bodyText = bodyLines.join(" ").trim();
  if (highlights.length > 0) {
    return { highlights, body: bodyText || undefined };
  }
  if (bodyText) {
    return { highlights: splitIntoSentences(bodyText) };
  }
  return {};
}

function parseWorkEntry(chunk: string[]): ResumeWork {
  const { start, end, headerText, highlights, bodyLines } = parseEntryBody(chunk);
  const { position, company } = splitHeader(headerText);
  const { highlights: finalHighlights, body } = highlightsAndBody(highlights, bodyLines);
  return {
    companyName: company || headerText || "Unknown Company",
    positionName: position,
    startDate: start,
    endDate: end,
    summary: body,
    highlights: finalHighlights,
  };
}

function parseEducationEntry(chunk: string[]): ResumeEducation {
  const { start, end, headerText, bodyLines } = parseEntryBody(chunk);
  // The degree line is often "Degree Name | <trailing text>". When that trailing text is a real
  // date range, parseEntryBody's date extraction has already stripped it out (start/end are set).
  // When it isn't a range ("Admitted for Aug 2026 (Studies Deferred)"), it's still real
  // information worth keeping — surface it as the date field rather than silently dropping it.
  const [degreePart, ...rest] = (bodyLines[0] ?? "").split("|").map((s) => s.trim());
  const trailingNote = rest.join(" | ");
  const hasDateRange = start !== undefined;

  return {
    institution: headerText || "Unknown Institution",
    studyType: degreePart || undefined,
    startDate: hasDateRange ? start : trailingNote || undefined,
    endDate: hasDateRange ? end : undefined,
  };
}

function parseProjectEntry(chunk: string[]): ResumeProject {
  const { start, end, headerText, highlights, bodyLines } = parseEntryBody(chunk);
  const { highlights: finalHighlights, body } = highlightsAndBody(highlights, bodyLines);
  return {
    name: headerText || "Untitled Project",
    startDate: start,
    endDate: end,
    description: body,
    highlights: finalHighlights,
  };
}

function parseSkills(lines: string[]): ResumeSkill[] {
  const keywords = lines
    .join(", ")
    .split(/[,;•\n]+/)
    .map((s) => s.replace(BULLET_RE, "").trim())
    .filter(Boolean);
  const unique = [...new Set(keywords)];
  return unique.length ? [{ name: "Skills", keywords: unique }] : [];
}

/**
 * Best-effort structuring of plain resume text into the app's ResumeData shape.
 * Always returns schema-valid data (falls back to placeholders) so the result can be
 * dropped straight into the JSON editor — accuracy is approximate, meant to save typing
 * on a typical single-column resume, not to be a flawless converter.
 */
export function parseResumeText(rawText: string): ResumeData {
  const text = rawText.replace(/\r\n/g, "\n");
  if (text.trim().length < MIN_TEXT_LENGTH) {
    throw new EmptyResumeTextError(
      "This file doesn't seem to contain readable text (it may be a scanned image). Try a text-based PDF/DOCX, or fill in the JSON manually.",
    );
  }

  const lines = text.split("\n").map((l) => l.trim());
  const { header, sections } = splitIntoSections(lines);
  const headerNonEmpty = header.filter((l) => l.length > 0);
  const nonEmptyLines = lines.filter((l) => l.length > 0);

  const name = headerNonEmpty[0] ?? nonEmptyLines[0] ?? "Your Name";
  const label = headerNonEmpty[1] && !isContactLine(headerNonEmpty[1]) ? headerNonEmpty[1] : undefined;
  const contact = extractContactInfo(text);

  const basics: ResumeBasics = {
    name,
    label,
    email: contact.email,
    phone: contact.phone,
    url: contact.url,
    summary: sections.summary?.join(" ").trim() || undefined,
    profiles: contact.profiles.length ? contact.profiles : undefined,
  };

  const work = sections.work ? splitIntoEntries(sections.work).map(parseWorkEntry) : undefined;
  const education = sections.education ? splitIntoEntries(sections.education).map(parseEducationEntry) : undefined;
  const projects = sections.projects ? splitIntoEntries(sections.projects).map(parseProjectEntry) : undefined;
  const skills = sections.skills ? parseSkills(sections.skills) : undefined;

  return {
    basics,
    work: work?.length ? work : undefined,
    education: education?.length ? education : undefined,
    skills: skills?.length ? skills : undefined,
    projects: projects?.length ? projects : undefined,
  };
}
