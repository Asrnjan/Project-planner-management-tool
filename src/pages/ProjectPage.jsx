import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function ProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (projectId) {
      navigate(`/planner?projectId=${projectId}&tab=overview`, {
        replace: true,
      });
    } else {
      navigate("/planner", { replace: true });
    }
  }, [projectId, navigate]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
      Opening project workspace...
    </div>
  );
}