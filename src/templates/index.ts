import type { ResumeData } from "../types/resume";
import { renderMinimal } from "./minimal/render";
import "./minimal/style.css";

export interface Template {
  id: string;
  name: string;
  render(resume: ResumeData): string;
}

export const templates: Template[] = [
  { id: "minimal", name: "Minimal", render: renderMinimal },
];

export function getTemplate(id: string): Template {
  return templates.find((t) => t.id === id) ?? templates[0];
}
