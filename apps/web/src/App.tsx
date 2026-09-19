import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Toaster } from 'sonner';

import { AuthProvider } from './context/AuthContext';
import { RepoProvider } from './context/RepoContext';
import { ProtectedRoute } from './components/ProtectedRoute';

const Landing = lazy(() => import('./pages/Landing').then(module => ({ default: module.Landing })));
const TopoFieldDemo = lazy(() => import('@/components/ui/demo'));
const Overview = lazy(() => import('./pages/Overview').then(module => ({ default: module.Overview })));
const Findings = lazy(() => import('./pages/Findings').then(module => ({ default: module.Findings })));
const Repositories = lazy(() => import('./pages/Repositories').then(module => ({ default: module.Repositories })));
const Scans = lazy(() => import('./pages/Scans').then(module => ({ default: module.Scans })));
const Dependencies = lazy(() => import('./pages/Dependencies').then(module => ({ default: module.Dependencies })));
const Secrets = lazy(() => import('./pages/Secrets').then(module => ({ default: module.Secrets })));
const Containers = lazy(() => import('./pages/Containers').then(module => ({ default: module.Containers })));
const IaC = lazy(() => import('./pages/IaC').then(module => ({ default: module.IaC })));
const Experiments = lazy(() => import('./pages/Experiments').then(module => ({ default: module.Experiments })));
const Reports = lazy(() => import('./pages/Reports').then(module => ({ default: module.Reports })));
const Settings = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));
const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Register = lazy(() => import('./pages/Register').then(module => ({ default: module.Register })));

const PageLoader = () => <div className="min-h-screen bg-[#02040a]" aria-label="Loading page" />;

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster theme="dark" position="bottom-right" />
        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/demo" element={<TopoFieldDemo />} />

          {/* Protected Dashboard Pages */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <RepoProvider>
                  <Layout>
                    <Routes>
                      <Route path="/dashboard" element={<Overview />} />
                      <Route path="/overview" element={<Overview />} />
                      <Route path="/findings" element={<Findings />} />
                      <Route path="/repositories" element={<Repositories />} />
                      <Route path="/scans" element={<Scans />} />
                      <Route path="/dependencies" element={<Dependencies />} />
                      <Route path="/secrets" element={<Secrets />} />
                      <Route path="/containers" element={<Containers />} />
                      <Route path="/iac" element={<IaC />} />
                      <Route path="/experiments" element={<Experiments />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </Layout>
                </RepoProvider>
              </ProtectedRoute>
            }
          />
        </Routes>
        </Suspense>
      </AuthProvider>
    </Router>
  );
}

export default App;

