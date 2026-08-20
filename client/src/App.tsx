import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const TerminalPage = lazy(() => import("./pages/Home"));
const ProductInformationPage = lazy(() => import("./pages/ProductInformationPage").then((module) => ({ default: module.ProductInformationPage })));

function RouteLoading({ label }: { label: string }) {
  return <div className="app-loading">{label}</div>;
}

function Router() {
  return (
    <Switch>
      <Route path="/">{() => <Suspense fallback={<RouteLoading label="Loading ZTerminal…" />}><LandingPage /></Suspense>}</Route>
      <Route path="/terminal">{() => <Suspense fallback={<RouteLoading label="Loading research terminal…" />}><TerminalPage /></Suspense>}</Route>
      <Route path="/account">{() => <Suspense fallback={<RouteLoading label="Loading account…" />}><AccountPage /></Suspense>}</Route>
      <Route path="/research">{() => <Suspense fallback={<RouteLoading label="Loading research workflow…" />}><ProductInformationPage kind="research" /></Suspense>}</Route>
      <Route path="/data-contract">{() => <Suspense fallback={<RouteLoading label="Loading data contract…" />}><ProductInformationPage kind="data-contract" /></Suspense>}</Route>
      <Route path="/access">{() => <Suspense fallback={<RouteLoading label="Loading access model…" />}><ProductInformationPage kind="access" /></Suspense>}</Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
