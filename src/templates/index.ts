import type { ResumeData } from "../types/resume";
import { renderMinimal } from "./minimal/render";
import "./minimal/style.css";
import { renderModern } from "./modern/render";
import "./modern/style.css";

export interface Template {
  id: string;
  name: string;
  render(resume: ResumeData): string;
}

export const templates: Template[] = [
  { id: "minimal", name: "Minimal", render: renderMinimal },
  { id: "modern", name: "Modern", render: renderModern },
];

export function getTemplate(id: string): Template {
  return templates.find((t) => t.id === id) ?? templates[0];
}
