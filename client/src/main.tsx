import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global error handler to prevent unhandled rejections from causing UI issues
window.addEventListener('unhandledrejection', (event) => {
  console.warn('Unhandled promise rejection caught and suppressed:', event.reason?.message || event.reason);
  event.preventDefault(); // Prevent the default behavior that causes kedip-kedip
});

// Global error handler for runtime errors
window.addEventListener('error', (event) => {
  console.warn('Global error caught and suppressed:', event.error?.message || event.error);
  event.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);
