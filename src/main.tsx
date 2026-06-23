
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { AppErrorBoundary } from "./app/components/AppErrorBoundary.tsx";
  import { installGlobalMonitoring } from "./app/quality/monitoring.ts";
  import "./styles/index.css";

  installGlobalMonitoring();
  createRoot(document.getElementById("root")!).render(<AppErrorBoundary><App /></AppErrorBoundary>);
  
