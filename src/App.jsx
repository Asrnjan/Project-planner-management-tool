import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";

import AppShell from "./components/layout/AppShell";
import Auth from "./components/Auth";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { isCloudConfigured, supabase } from "./lib/supabaseClient";
import {
  flushPendingCloudSave,
  hasPendingCloudSave,
  pullCloudChanges,
  usePlannerStore,
} from "./store/usePlannerStore";
import { useAccessStore } from "./store/useAccessStore";
import { Button, FeedbackHost } from "./ui/primitives";
import { notify } from "./ui/feedback";

const PortfolioPage = lazy(() => import("./pages/PortfolioPage"));
const ProjectPage = lazy(() => import("./pages/ProjectPage"));
const PlannerPage = lazy(() => import("./pages/PlannerPage"));
const DataPage = lazy(() => import("./pages/DataPage"));
const AssistantPage = lazy(() => import("./pages/AssistantPage"));
const HelpPage = lazy(() => import("./pages/HelpPage"));
const TimesheetPage = lazy(() => import("./pages/TimesheetPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));

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
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        {children}
      </div>
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
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
  const [noAccess, setNoAccess] = useState(false);
  const initializeAccess = useAccessStore((state) => state.initialize);
  const resetAccess = useAccessStore((state) => state.reset);
  const idleSignOutMinutes = useAccessStore((state) => Number(state.rules?.security?.idleSignOutMinutes || 0));

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
    async (user) => {
      try {
        setWorkspaceLoading(true);
        setWorkspaceError("");
        setNoAccess(false);
        // Who you are in the team decides what you can see, so access loads
        // before any project data.
        const accessStatus = await initializeAccess("cloud", { email: user.email || "" });
        if (accessStatus === "no_access") {
          setNoAccess(true);
          lastLoadedUserIdRef.current = user.id;
          return;
        }
        if (accessStatus === "error") {
          throw new Error(useAccessStore.getState().error || "Could not load your access.");
        }
        await initializeWorkspaceForCurrentUser();
        lastLoadedUserIdRef.current = user.id;
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
    [initializeWorkspaceForCurrentUser, initializeAccess]
  );

  useEffect(() => {
    if (localMode) {
      initializeLocalWorkspace();
      initializeAccess("local");
    }
  }, [localMode, initializeLocalWorkspace, initializeAccess]);

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
          return loadWorkspaceForUser(data.session.user);
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
        loadWorkspaceForUser(sessionData.user);
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [localMode, loadWorkspaceForUser]);

  // Bring in teammates' changes every minute and when the tab regains focus.
  const cloudReady = !localMode && Boolean(session) && !noAccess && !workspaceLoading && !authLoading;
  useEffect(() => {
    if (!cloudReady) return undefined;
    const pull = () => {
      if (document.visibilityState === "hidden") return;
      pullCloudChanges().catch((error) => console.warn("Could not refresh from the cloud:", error));
    };
    const timer = window.setInterval(pull, 60_000);
    window.addEventListener("focus", pull);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", pull);
    };
  }, [cloudReady]);

  // Workspace rule: sign out after a period without activity.
  const logoutRef = useRef(null);
  useEffect(() => {
    if (!cloudReady || !idleSignOutMinutes) return undefined;
    let timer = null;
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => logoutRef.current?.("idle"), idleSignOutMinutes * 60_000);
    };
    const events = ["pointerdown", "keydown", "scroll", "visibilitychange"];
    events.forEach((name) => window.addEventListener(name, reset, { passive: true }));
    reset();
    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, reset));
    };
  }, [cloudReady, idleSignOutMinutes]);

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

  async function handleLogout(reason) {
    resetAccess();
    setNoAccess(false);
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
      if (reason === "idle") {
        notify.info("You were signed out after a period of inactivity.");
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setAuthLoading(false);
      setWorkspaceLoading(false);
    }
  }

  logoutRef.current = handleLogout;

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
              if (session?.user?.id) loadWorkspaceForUser(session.user);
              else setWorkspaceError("");
            }}
          >
            Try again
          </Button>
          <Button onClick={() => handleLogout()}>Sign out</Button>
        </div>
      </FullPageMessage>
    );
  }

  if (!localMode && session && noAccess) {
    const email = session.user?.email || "";
    return (
      <FullPageMessage>
        <h1 className="text-lg font-semibold text-slate-900">You haven't been added to this workspace yet</h1>
        <p className="mt-2 text-sm text-slate-600">
          You're signed in as <strong>{email}</strong>. Ask your administrator to add this email address in
          Admin &rarr; Users, then sign in again.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="primary" onClick={() => loadWorkspaceForUser(session.user)}>
            I've been added, try again
          </Button>
          <Button onClick={() => handleLogout()}>Sign out</Button>
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
        onLogout={() => handleLogout()}
      >
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/" element={<PortfolioPage />} />
              <Route path="/project/:projectId" element={<ProjectPage />} />
              <Route path="/planner" element={<PlannerPage />} />
              <Route path="/data" element={<DataPage />} />
              <Route path="/assistant" element={<AssistantPage />} />
              <Route path="/timesheet" element={<TimesheetPage />} />
              <Route path="/admin" element={<AdminPage />} />
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
