import { createImportRunner } from "./app.js";
import { createUi } from "./ui/ui.js";

if (window.top === window.self) {
  let runImport = () => {};
  const ui = createUi({ onImport: () => runImport() });
  runImport = createImportRunner({ ui });
}
