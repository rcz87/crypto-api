import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WebSocketProvider } from "@/hooks/WebSocketProvider";
import { SymbolProvider } from "@/contexts/SymbolContext";
import Dashboard from "@/pages/dashboard";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import NotFound from "@/pages/not-found";
import MultiCoinScreening from "@/components/MultiCoinScreening";

function Router() {
  return (
    <Switch>
      {/* Default redirect to SOLUSDT for backward compatibility */}
      <Route path="/">
        {() => <Redirect to="/SOLUSDT" />}
      </Route>
      
      {/* Symbol-aware routes */}
      <Route path="/:symbol" component={Dashboard} />
      <Route path="/:symbol/realtime" component={Dashboard} />
      <Route path="/:symbol/technical" component={Dashboard} />
      <Route path="/:symbol/fibonacci" component={Dashboard} />
      <Route path="/:symbol/confluence" component={Dashboard} />
      <Route path="/:symbol/mtf" component={Dashboard} />
      <Route path="/:symbol/oi" component={Dashboard} />
      <Route path="/:symbol/funding" component={Dashboard} />
      
      {/* Multi-coin screener */}
      <Route path="/screener" component={MultiCoinScreening} />
      
      {/* Static pages */}
      <Route path="/privacy" component={Privacy} />
      <Route path="/privacy-policy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/terms-of-service" component={Terms} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SymbolProvider>
        <WebSocketProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </WebSocketProvider>
      </SymbolProvider>
    </QueryClientProvider>
  );
}

export default App;
