import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

import AppShell from "./components/layout/AppShell";
import PortfolioPage from "./pages/PortfolioPage";
import ProjectPage from "./pages/ProjectPage";
import PlannerPage from "./pages/PlannerPage";

import { supabase } from "./lib/supabaseClient";
import Auth from "./components/Auth";

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sessionData) => {
      setSession(sessionData);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function initializeAuth() {
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      setSession(currentSession);
    } catch (error) {
      console.error("Supabase auth error:", error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
  }

  if (authLoading) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.loadingCard}>Loading...</div>
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
    padding: "24px 32px",
    background: "#ffffff",
    borderRadius: "12px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    fontSize: "16px",
    fontWeight: "600",
  },
};