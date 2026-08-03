import type { ResumeData, ResumeSection, ResumeEntryItem, ResumeSkillItem } from "../types/resume";

type Notify = () => void;
type Rebuild = () => void;
type ShowMessage = (message: string) => void;

function smallInputEl(labelText: string, value: string, onInput: (v: string) => void): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "form-field";
  const span = document.createElement("span");
  span.textContent = labelText;
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.addEventListener("input", () => onInput(input.value));
  label.append(span, input);
  return label;
}

/**
 * `formPath`, when given, mirrors the same JSON-path convention the preview's editable prose
 * fields use for their `data-path` attribute (see src/templates/shared/render.ts) — set as
 * `data-form-path` here so clicking into the corresponding preview field can look this element up
 * and scroll to it. Only set on textareas that actually have a preview counterpart (summary,
 * highlights, text-section content) — plain fields like name/email have none.
 */
function labeledTextarea(
  labelText: string,
  value: string,
  onInput: (v: string) => void,
  rows = 2,
  formPath?: string,
): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "form-field form-field-multiline";
  const span = document.createElement("span");
  span.textContent = labelText;
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.rows = rows;
  if (formPath) textarea.dataset.formPath = formPath;
  textarea.addEventListener("input", () => onInput(textarea.value));
  label.append(span, textarea);
  return label;
}

function actionButton(text: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = text;
  btn.addEventListener("click", onClick);
  return btn;
}

function swap<T>(arr: T[], i: number, j: number): void {
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

/**
 * After a reorder, the moved row visually relocates — a second click at the same screen position
 * would otherwise land on whatever *different* row slid into that spot. Scrolling the moved item
 * into view and flashing it makes it unambiguous where it ended up, so the user re-locates the
 * right button before clicking again instead of unknowingly acting on a neighboring row.
 */
function highlightAndScrollTo(el: HTMLElement | null): void {
  if (!el) return;
  el.scrollIntoView({ block: "center" });
  el.classList.add("form-just-moved");
  window.setTimeout(() => el.classList.remove("form-just-moved"), 900);
}

function buildBasicsFieldset(data: ResumeData, notify: Notify, rebuild: Rebuild): HTMLFieldSetElement {
  const fs = document.createElement("fieldset");
  fs.className = "form-fieldset";
  const legend = document.createElement("legend");
  legend.textContent = "Basics";
  fs.appendChild(legend);

  const { basics } = data;
  fs.appendChild(
    smallInputEl("Name", basics.name, (v) => {
      basics.name = v;
      notify();
    }),
  );
  fs.appendChild(
    smallInputEl("Label", basics.label ?? "", (v) => {
      basics.label = v || undefined;
      notify();
    }),
  );
  fs.appendChild(
    smallInputEl("Email", basics.email ?? "", (v) => {
      basics.email = v || undefined;
      notify();
    }),
  );
  fs.appendChild(
    smallInputEl("Phone", basics.phone ?? "", (v) => {
      basics.phone = v || undefined;
      notify();
    }),
  );
  fs.appendChild(
    smallInputEl("URL", basics.url ?? "", (v) => {
      basics.url = v || undefined;
      notify();
    }),
  );
  fs.appendChild(
    labeledTextarea(
      "Summary",
      basics.summary ?? "",
      (v) => {
        basics.summary = v || undefined;
        notify();
      },
      3,
      "basics.summary",
    ),
  );

  fs.appendChild(
    smallInputEl("City", basics.location?.city ?? "", (v) => {
      basics.location = { ...basics.location, city: v || undefined };
      notify();
    }),
  );
  fs.appendChild(
    smallInputEl("Region", basics.location?.region ?? "", (v) => {
      basics.location = { ...basics.location, region: v || undefined };
      notify();
    }),
  );
  fs.appendChild(
    smallInputEl("Country code", basics.location?.countryCode ?? "", (v) => {
      basics.location = { ...basics.location, countryCode: v || undefined };
      notify();
    }),
  );

  const profilesWrap = document.createElement("div");
  profilesWrap.className = "form-items";
  (basics.profiles ?? []).forEach((profile, i) => {
    const row = document.createElement("div");
    row.className = "form-item form-item-inline";
    row.appendChild(
      smallInputEl("Network name", profile.network ?? "", (v) => {
        profile.network = v || undefined;
        notify();
      }),
    );
    row.appendChild(
      smallInputEl("URL", profile.url ?? "", (v) => {
        profile.url = v || undefined;
        notify();
      }),
    );
    row.appendChild(
      actionButton("Remove link", () => {
        basics.profiles!.splice(i, 1);
        notify();
        rebuild();
      }),
    );
    profilesWrap.appendChild(row);
  });
  fs.appendChild(profilesWrap);
  fs.appendChild(
    actionButton("Add link", () => {
      basics.profiles = [...(basics.profiles ?? []), { network: "", url: "" }];
      notify();
      rebuild();
    }),
  );

  return fs;
}

function buildEntryItemForm(
  item: ResumeEntryItem,
  basePath: string,
  notify: Notify,
  onRemove: () => void,
  onMoveUp: () => void,
  onMoveDown: () => void,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "form-item";

  wrap.appendChild(
    smallInputEl("Heading (company, institution, project)", item.heading, (v) => {
      item.heading = v;
      notify();
    }),
  );
  wrap.appendChild(
    smallInputEl("Subheading (position, degree)", item.subheading ?? "", (v) => {
      item.subheading = v || undefined;
      notify();
    }),
  );
  wrap.appendChild(
    smallInputEl("URL", item.url ?? "", (v) => {
      item.url = v || undefined;
      notify();
    }),
  );
  wrap.appendChild(
    smallInputEl("Start date (e.g. 2024-01)", item.startDate ?? "", (v) => {
      item.startDate = v || undefined;
      notify();
    }),
  );
  wrap.appendChild(
    smallInputEl("End date (blank = Present)", item.endDate ?? "", (v) => {
      item.endDate = v;
      notify();
    }),
  );
  wrap.appendChild(
    labeledTextarea(
      "Summary",
      item.summary ?? "",
      (v) => {
        item.summary = v || undefined;
        notify();
      },
      2,
      `${basePath}.summary`,
    ),
  );
  wrap.appendChild(
    labeledTextarea(
      "Highlights (one per line)",
      (item.highlights ?? []).join("\n"),
      (v) => {
        const lines = v
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        item.highlights = lines.length ? lines : undefined;
        notify();
      },
      4,
      `${basePath}.highlights`,
    ),
  );

  const actions = document.createElement("div");
  actions.className = "form-item-actions";
  actions.appendChild(actionButton("Move entry up", onMoveUp));
  actions.appendChild(actionButton("Move entry down", onMoveDown));
  actions.appendChild(actionButton("Remove entry", onRemove));
  wrap.appendChild(actions);

  return wrap;
}

function buildSkillItemForm(item: ResumeSkillItem, notify: Notify, onRemove: () => void): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "form-item";
  wrap.appendChild(
    smallInputEl("Group name", item.name, (v) => {
      item.name = v;
      notify();
    }),
  );
  wrap.appendChild(
    smallInputEl("Level", item.level ?? "", (v) => {
      item.level = v || undefined;
      notify();
    }),
  );
  wrap.appendChild(
    smallInputEl("Keywords (comma-separated)", (item.keywords ?? []).join(", "), (v) => {
      const keywords = v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      item.keywords = keywords.length ? keywords : undefined;
      notify();
    }),
  );

  const actions = document.createElement("div");
  actions.className = "form-item-actions";
  actions.appendChild(actionButton("Remove skill group", onRemove));
  wrap.appendChild(actions);

  return wrap;
}

function buildSectionFieldset(
  container: HTMLElement,
  data: ResumeData,
  index: number,
  notify: Notify,
  rebuild: Rebuild,
  showMessage: ShowMessage,
): HTMLFieldSetElement {
  const section = data.sections[index];
  const basePath = `sections.${index}`;
  const fs = document.createElement("fieldset");
  fs.className = "form-fieldset form-section";
  fs.dataset.sectionIndex = String(index);

  const legend = document.createElement("legend");
  legend.textContent = `${section.title || "Untitled section"} (${section.type})`;
  fs.appendChild(legend);

  fs.appendChild(
    smallInputEl("Section title", section.title, (v) => {
      section.title = v;
      legend.textContent = `${v || "Untitled section"} (${section.type})`;
      notify();
    }),
  );

  const sectionActions = document.createElement("div");
  sectionActions.className = "form-item-actions";
  sectionActions.appendChild(
    actionButton("Move section up", () => {
      if (index === 0) {
        showMessage(`"${section.title || "This section"}" is already at the top.`);
        return;
      }
      swap(data.sections, index - 1, index);
      const newIndex = index - 1;
      notify();
      rebuild();
      highlightAndScrollTo(container.querySelector(`[data-section-index="${newIndex}"]`));
    }),
  );
  sectionActions.appendChild(
    actionButton("Move section down", () => {
      if (index === data.sections.length - 1) {
        showMessage(`"${section.title || "This section"}" is already at the bottom.`);
        return;
      }
      swap(data.sections, index, index + 1);
      const newIndex = index + 1;
      notify();
      rebuild();
      highlightAndScrollTo(container.querySelector(`[data-section-index="${newIndex}"]`));
    }),
  );
  sectionActions.appendChild(
    actionButton("Remove section", () => {
      data.sections.splice(index, 1);
      notify();
      rebuild();
    }),
  );
  fs.appendChild(sectionActions);

  const itemsWrap = document.createElement("div");
  itemsWrap.className = "form-items";

  if (section.type === "entries") {
    section.items.forEach((item, i) => {
      const entryEl = buildEntryItemForm(
        item,
        `${basePath}.items.${i}`,
        notify,
        () => {
          section.items.splice(i, 1);
          notify();
          rebuild();
        },
        () => {
          if (i === 0) {
            showMessage(`"${item.heading || "This entry"}" is already at the top of "${section.title}".`);
            return;
          }
          swap(section.items, i - 1, i);
          const newIndex = i - 1;
          notify();
          rebuild();
          highlightAndScrollTo(
            container.querySelector(`[data-section-index="${index}"] [data-entry-index="${newIndex}"]`),
          );
        },
        () => {
          if (i === section.items.length - 1) {
            showMessage(`"${item.heading || "This entry"}" is already at the bottom of "${section.title}".`);
            return;
          }
          swap(section.items, i, i + 1);
          const newIndex = i + 1;
          notify();
          rebuild();
          highlightAndScrollTo(
            container.querySelector(`[data-section-index="${index}"] [data-entry-index="${newIndex}"]`),
          );
        },
      );
      entryEl.dataset.entryIndex = String(i);
      itemsWrap.appendChild(entryEl);
    });
    fs.appendChild(itemsWrap);
    fs.appendChild(
      actionButton("Add entry", () => {
        section.items.push({ heading: "New entry" });
        notify();
        rebuild();
      }),
    );
  } else if (section.type === "skills") {
    section.items.forEach((item, i) => {
      itemsWrap.appendChild(
        buildSkillItemForm(item, notify, () => {
          section.items.splice(i, 1);
          notify();
          rebuild();
        }),
      );
    });
    fs.appendChild(itemsWrap);
    fs.appendChild(
      actionButton("Add skill group", () => {
        section.items.push({ name: "New group", keywords: [] });
        notify();
        rebuild();
      }),
    );
  } else {
    fs.appendChild(
      labeledTextarea(
        "Content",
        section.items,
        (v) => {
          section.items = v;
          notify();
        },
        4,
        `${basePath}.items`,
      ),
    );
  }

  return fs;
}

function buildAddSectionControl(data: ResumeData, notify: Notify, rebuild: Rebuild): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "form-add-section";

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.placeholder = "New section title (e.g. Certifications)";

  const typeSelect = document.createElement("select");
  typeSelect.innerHTML =
    '<option value="entries">Entries (jobs, degrees, projects)</option>' +
    '<option value="skills">Skills</option>' +
    '<option value="text">Text</option>';

  wrap.append(
    titleInput,
    typeSelect,
    actionButton("Add section", () => {
      const title = titleInput.value.trim() || "New section";
      const type = typeSelect.value as ResumeSection["type"];
      const newSection: ResumeSection =
        type === "skills"
          ? { title, type, items: [] }
          : type === "text"
            ? { title, type, items: "" }
            : { title, type: "entries", items: [] };
      data.sections.push(newSection);
      notify();
      rebuild();
    }),
  );

  return wrap;
}

/**
 * Builds a dynamic form UI for `data` inside `container`, calling `onChange(data)` on every edit
 * — field edits mutate `data` in place and notify without rebuilding (so typing doesn't lose
 * focus/cursor position); structural edits (add/remove/reorder) rebuild the whole form, which is
 * fine since those are discrete button clicks, not per-keystroke typing. `onChange` is expected to
 * serialize `data` back into the JSON source text and re-render — the form never becomes its own
 * separate source of truth, it's just another way to produce the same JSON.
 */
export function renderFormEditor(
  container: HTMLElement,
  data: ResumeData,
  onChange: (data: ResumeData) => void,
  showMessage: ShowMessage,
): void {
  const notify: Notify = () => onChange(data);
  const rebuild: Rebuild = () => renderFormEditor(container, data, onChange, showMessage);

  container.innerHTML = "";
  container.appendChild(buildBasicsFieldset(data, notify, rebuild));

  const sectionsHeading = document.createElement("h3");
  sectionsHeading.className = "form-sections-heading";
  sectionsHeading.textContent = "Sections";
  container.appendChild(sectionsHeading);

  data.sections.forEach((_, i) => {
    container.appendChild(buildSectionFieldset(container, data, i, notify, rebuild, showMessage));
  });

  container.appendChild(buildAddSectionControl(data, notify, rebuild));
}
