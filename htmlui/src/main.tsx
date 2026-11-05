import "./i18n";
import "@mantine/core/styles.layer.css";
import "@mantine/dates/styles.layer.css";
import "@mantine/notifications/styles.layer.css";
import "mantine-datatable/styles.layer.css";
import "@mantine/charts/styles.layer.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import BaseLayout from "./BaseLayout.tsx";
import { useAppContext } from "./core/context/AppContext";
import "./index.css";
import PoliciesPage from "./policies/PoliciesPage.tsx";
import PreferencesPage from "./preferences/PreferencesPage.tsx";
import RepoPage from "./repo/RepoPage.tsx";
import SnapshotDirectory from "./snapshot-directory/SnapshotDirectory.tsx";
import SnapshotHistory from "./snapshot-history/SnapshotHistory.tsx";
import SnapshotMountsPage from "./snapshot-mounts/SnapshotMountsPage.tsx";
import SnapshotsPage from "./snapshots/SnapshotsPage.tsx";
import TaskDetailsPage from "./tasks/TaskDetailsPage.tsx";
import TasksPage from "./tasks/TasksPage.tsx";

function HomePage() {
  const { repoStatus } = useAppContext();
  return <Navigate to={repoStatus.connected ? "/snapshots" : "/repo"} replace />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<BaseLayout />}>
          <Route path="/snapshots" element={<SnapshotsPage />} />
          <Route path="/snapshots/single-source" element={<SnapshotHistory />} />
          <Route path="/snapshots/dir/:oid" element={<SnapshotDirectory />} />
          <Route path="/snapshots/mounts" element={<SnapshotMountsPage />} />
          <Route path="/mounts" element={<Navigate to="/snapshots/mounts" replace />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/:tid" element={<TaskDetailsPage />} />
          <Route path="/policies" element={<PoliciesPage />} />
          <Route path="/preferences" element={<PreferencesPage />} />
          <Route path="/repo" element={<RepoPage />} />
          <Route path="/" element={<HomePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
