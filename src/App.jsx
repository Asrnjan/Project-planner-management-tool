import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";

import AppShell from "./components/layout/AppShell";
import Auth from "./components/Auth";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { isCloudConfigured, supabase } from "./lib/supabaseClient";
import {
  flushPendingCloudSave,
  hasPendingCloudSave,
  usePlannerStore,
} from "./store/usePlannerStore";
import { Button, FeedbackHost } from "./ui/primitives";

const PortfolioPage = lazy(() => import("./pages/PortfolioPage"));
const ProjectPage = lazy(() => import("./pages/ProjectPage"));
const PlannerPage = lazy(() => import("./pages/PlannerPage"));
const DataPage = lazy(() => import("./pages/DataPage"));
const AssistantPage = lazy(() => import("./pages/AssistantPage"));
const HelpPage = lazy(() => import("./pages/HelpPage"));

const LOCAL_MODE_KEY = "pm-local-mode";

function readLocalModeChoice() {
  try {
    return localStorage.getItem(LOCAL_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeLocalModeChoice(enabled) {
  try {
    if (enabled) localStorage.setItem(LOCAL_MODE_KEY, "1");
    else localStorage.removeItem(LOCAL_MODE_KEY);
  } catch {
    // Storage can be blocked (private mode); local mode then lasts for this tab.
  }
}

function FullPageMessage({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        {children}
      </div>
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      Loading...
    </div>
  );
}

export default function App() {
  const location = useLocation();
  // Local mode: no Supabase configured, or the user chose not to sign in.
  const [localMode, setLocalMode] = useState(
    () => !isCloudConfigured || readLocalModeChoice()
  );
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(isCloudConfigured && !localMode);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");

  const lastLoadedUserIdRef = useRef("");

  const initializeWorkspaceForCurrentUser = usePlannerStore(
    (state) => state.initializeWorkspaceForCurrentUser
  );
  const initializeLocalWorkspace = usePlannerStore(
    (state) => state.initializeLocalWorkspace
  );
  const clearWorkspaceForLogout = usePlannerStore(
    (state) => state.clearWorkspaceForLogout
  );

  const loadWorkspaceForUser = useCallback(
    async (userId) => {
      try {
        setWorkspaceLoading(true);
        setWorkspaceError("");
        await initializeWorkspaceForCurrentUser();
        lastLoadedUserIdRef.current = userId;
      } catch (error) {
        console.error("Workspace load error:", error);
        setWorkspaceError(
          error?.message || "Failed to load workspace. Please refresh and try again."
        );
      } finally {
        setWorkspaceLoading(false);
        setAuthLoading(false);
      }
    },
    [initializeWorkspaceForCurrentUser]
  );

  useEffect(() => {
    if (localMode) {
      initializeLocalWorkspace();
    }
  }, [localMode, initializeLocalWorkspace]);

  useEffect(() => {
    if (localMode || !supabase) return undefined;

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        if (!mounted) return;

        setSession(data.session);

        if (data.session?.user?.id) {
          return loadWorkspaceForUser(data.session.user.id);
        }

        setAuthLoading(false);
        return undefined;
      })
      .catch((error) => {
        console.error("Supabase auth error:", error);
        if (mounted) {
          setWorkspaceError(error?.message || "Failed to initialize login.");
          setAuthLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sessionData) => {
      setSession(sessionData);

      const nextUserId = sessionData?.user?.id || "";

      if (!nextUserId) {
        lastLoadedUserIdRef.current = "";
        setAuthLoading(false);
        setWorkspaceLoading(false);
        return;
      }

      if (lastLoadedUserIdRef.current === nextUserId) {
        setAuthLoading(false);
        return;
      }

      // Supabase recommends not awaiting other Supabase calls inside this
      // callback, so the workspace load runs on the next tick.
      setTimeout(() => {
        loadWorkspaceForUser(nextUserId);
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [localMode, loadWorkspaceForUser]);

  // Warn before closing the tab while a cloud save is still waiting.
  useEffect(() => {
    function onBeforeUnload(event) {
      if (hasPendingCloudSave()) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  async function handleLogout() {
    if (localMode) {
      // Leaving local mode keeps the browser data; it is there next time.
      writeLocalModeChoice(false);
      clearWorkspaceForLogout();
      setLocalMode(!isCloudConfigured);
      return;
    }

    try {
      await flushPendingCloudSave();
      lastLoadedUserIdRef.current = "";
      clearWorkspaceForLogout();
      await supabase.auth.signOut();
      setSession(null);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setAuthLoading(false);
      setWorkspaceLoading(false);
    }
  }

  function handleUseLocalMode() {
    writeLocalModeChoice(true);
    setLocalMode(true);
  }

  if (!localMode && (authLoading || workspaceLoading)) {
    return (
      <FullPageMessage>
        <div className="flex items-center justify-center gap-3 text-sm font-medium text-slate-600">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
          {authLoading ? "Signing you in..." : "Loading your workspace..."}
        </div>
      </FullPageMessage>
    );
  }

  if (!localMode && workspaceError) {
    return (
      <FullPageMessage>
        <h1 className="text-lg font-semibold text-slate-900">We couldn't load your workspace</h1>
        <p className="mt-2 text-sm text-slate-600">{workspaceError}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button
            variant="primary"
            onClick={() => {
              const userId = session?.user?.id || "";
              if (userId) loadWorkspaceForUser(userId);
              else setWorkspaceError("");
            }}
          >
            Try again
          </Button>
          <Button onClick={handleLogout}>Sign out</Button>
        </div>
      </FullPageMessage>
    );
  }

  if (!localMode && !session) {
    return (
      <>
        <Auth onUseLocalMode={handleUseLocalMode} />
        <FeedbackHost />
      </>
    );
  }

  const effectiveSession = localMode
    ? { user: { id: "local", email: "" } }
    : session;

  return (
    <>
      <AppShell
        session={effectiveSession}
        localMode={localMode}
        canSignIn={isCloudConfigured}
        onLogout={handleLogout}
      >
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/" element={<PortfolioPage />} />
              <Route path="/project/:projectId" element={<ProjectPage />} />
              <Route path="/planner" element={<PlannerPage />} />
              <Route path="/data" element={<DataPage />} />
              <Route path="/assistant" element={<AssistantPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AppShell>
      <FeedbackHost />
    </>
  );
}
