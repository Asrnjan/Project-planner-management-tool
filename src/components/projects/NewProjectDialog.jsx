import { useNavigate } from "react-router-dom";
import { usePlannerStore } from "../../store/usePlannerStore";
import { useUiStore } from "../../ui/uiStore";
import { notify } from "../../ui/feedback";
import { Modal } from "../../ui/primitives";
import ProjectForm from "./ProjectForm";

export default function NewProjectDialog() {
  const open = useUiStore((state) => state.newProjectOpen);
  const close = useUiStore((state) => state.closeNewProject);
  const addProject = usePlannerStore((state) => state.addProject);
  const navigate = useNavigate();

  function handleSubmit(values) {
    const project = addProject(values);
    close();
    notify.success(`"${project.name}" created. Add your first tasks below.`);
    navigate(`/planner?projectId=${encodeURIComponent(project.id)}&tab=schedule`);
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="New project"
      description="Only the name is required. You can change everything later."
    >
      <ProjectForm onSubmit={handleSubmit} onCancel={close} />
    </Modal>
  );
}
