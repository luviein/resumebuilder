import "./styles/app.css";
import { initEditorCore, render } from "./ui/editorCore";
import { initEditorTabs, setActiveTab, setActiveEditorTab } from "./ui/editorTabs";
import { initCustomizeDialog } from "./ui/customizeDialog";
import { initHistoryDialog } from "./ui/historyDialog";
import { initFormatToolbar } from "./ui/formatToolbar";
import { initImportExport } from "./ui/importExport";

initEditorCore();
initCustomizeDialog();
initHistoryDialog();
initEditorTabs();
initFormatToolbar();
initImportExport();

setActiveTab("edit");
render();
setActiveEditorTab("form");

if ("serviceWorker" in navigator) {
  import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true }));
}
