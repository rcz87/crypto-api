import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global error handler to prevent unhandled rejections from causing UI issues
window.addEventListener('unhandledrejection', (event) => {
  const errorMessage = event.reason?.message || event.reason;
  
  // Suppress Replit development environment WebSocket warnings
  if (typeof errorMessage === 'string' && 
      (errorMessage.includes('localhost:undefined') || 
       errorMessage.includes('wss://localhost:undefined') ||
       (errorMessage.includes('WebSocket') && errorMessage.includes('invalid')) ||
       errorMessage.includes('Failed to construct \'WebSocket\''))) {
    // Silently suppress Replit Cartographer/Vite HMR WebSocket warnings
    event.preventDefault();
    return;
  }
  
  console.warn('Unhandled promise rejection caught and suppressed:', errorMessage);
  event.preventDefault(); // Prevent the default behavior that causes kedip-kedip
});

// Global error handler for runtime errors
window.addEventListener('error', (event) => {
  console.warn('Global error caught and suppressed:', event.error?.message || event.error);
  event.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);
