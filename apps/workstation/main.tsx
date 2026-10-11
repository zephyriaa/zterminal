import { createRoot } from "react-dom/client";
import { LocalWorkstation } from "./workstation";
import { localPlatform } from "../../src/lib/workstation-platform";
import "./style.css";
createRoot(document.getElementById("root")!).render(<LocalWorkstation platform={localPlatform} />);
