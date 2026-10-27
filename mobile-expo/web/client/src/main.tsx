import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./lib/register-sw";
import { installApiBaseInterceptor } from "./lib/api-base";

installApiBaseInterceptor();
registerServiceWorker();

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
