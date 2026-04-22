import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import PortfolioPage from "./pages/PortfolioPage";
import ProjectPage from "./pages/ProjectPage";
import PlannerPage from "./pages/PlannerPage";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<PortfolioPage />} />
        <Route path="/project/:projectId" element={<ProjectPage />} />
        <Route path="/planner" element={<PlannerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}