import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

import AppShell from "./components/layout/AppShell";
import PortfolioPage from "./pages/PortfolioPage";
import ProjectPage from "./pages/ProjectPage";
import PlannerPage from "./pages/PlannerPage";

import { supabase } from "./lib/supabaseClient";
import Auth from "./components/Auth";
import { usePlannerStore } from "./store/usePlannerStore";

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");

  const lastLoadedUserIdRef = useRef("");

  const initializeWorkspaceForCurrentUser = usePlannerStore(
    (state) => state.initializeWorkspaceForCurrentUser
  );

  const clearWorkspaceForLogout = usePlannerStore(
    (state) => state.clearWorkspaceForLogout
  );

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!mounted) return;

        setSession(currentSession);

        if (currentSession?.user?.id) {
          await loadWorkspaceForUser(currentSession.user.id);
        } else {
          clearWorkspaceForLogout();
        }
      } catch (error) {
        console.error("Supabase auth error:", error);
        setWorkspaceError(error?.message || "Failed to initialize login.");
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    }

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sessionData) => {
      setSession(sessionData);

      const nextUserId = sessionData?.user?.id || "";

      if (!nextUserId) {
        lastLoadedUserIdRef.current = "";
        clearWorkspaceForLogout();
        setAuthLoading(false);
        setWorkspaceLoading(false);
        return;
      }

      if (lastLoadedUserIdRef.current === nextUserId) {
        setAuthLoading(false);
        return;
      }

      setTimeout(() => {
        loadWorkspaceForUser(nextUserId).catch((error) => {
          console.error("Workspace load after auth change failed:", error);
        });
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function loadWorkspaceForUser(userId) {
    try {
      setWorkspaceLoading(true);
      setWorkspaceError("");

      await initializeWorkspaceForCurrentUser();

      lastLoadedUserIdRef.current = userId;
    } catch (error) {
      console.error("Workspace load error:", error);

      setWorkspaceError(
        error?.message ||
          "Failed to load workspace. Please refresh and try again."
      );
    } finally {
      setWorkspaceLoading(false);
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    try {
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

  if (authLoading || workspaceLoading) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.loadingCard}>
          {authLoading ? "Loading..." : "Loading your workspace..."}
        </div>
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.errorCard}>
          <h3 style={styles.errorTitle}>Workspace Load Failed</h3>

          <p style={styles.errorText}>{workspaceError}</p>

          <button
            type="button"
            onClick={() => {
              const userId = session?.user?.id || "";

              if (userId) {
                loadWorkspaceForUser(userId);
              } else {
                setWorkspaceError("");
                setAuthLoading(false);
                setWorkspaceLoading(false);
              }
            }}
            style={styles.retryButton}
          >
            Retry
          </button>

          <button type="button" onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <AppShell session={session} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<PortfolioPage session={session} />} />

        <Route
          path="/project/:projectId"
          element={<ProjectPage session={session} />}
        />

        <Route path="/planner" element={<PlannerPage session={session} />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

const styles = {
  loadingPage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f5f6fa",
  },
  loadingCard: {
    minWidth: "140px",
    padding: "24px 32px",
    background: "#ffffff",
    borderRadius: "12px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    fontSize: "16px",
    fontWeight: "600",
    textAlign: "center",
  },
  errorCard: {
    width: "420px",
    padding: "28px",
    background: "#ffffff",
    borderRadius: "14px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  },
  errorTitle: {
    margin: "0 0 10px",
    fontSize: "18px",
    fontWeight: "700",
    color: "#111827",
  },
  errorText: {
    margin: "0 0 18px",
    fontSize: "14px",
    lineHeight: "22px",
    color: "#4b5563",
  },
  retryButton: {
    width: "100%",
    padding: "11px 14px",
    border: "none",
    borderRadius: "10px",
    background: "#111827",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    marginBottom: "10px",
  },
  logoutButton: {
    width: "100%",
    padding: "11px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    background: "#ffffff",
    color: "#374151",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
  },
};