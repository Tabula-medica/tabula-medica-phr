import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./lib/register-sw";
import { flushSignupQueue } from "./lib/signup-queue";

registerServiceWorker();

// Retry-flush any early-access sign-ups queued while offline / without an endpoint.
void flushSignupQueue();

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
