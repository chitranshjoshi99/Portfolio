import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProjectListPage } from '../features/project-list/project-list-page';
import { ProjectPage } from '../features/project-page/project-page';

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<ProjectListPage />} />
        <Route path="/projects/:projectId" element={<ProjectPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
