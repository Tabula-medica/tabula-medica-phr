import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./lib/register-sw";

registerServiceWorker();

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
