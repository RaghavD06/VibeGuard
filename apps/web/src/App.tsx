import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import TopoFieldDemo from '@/components/ui/demo';
import { Overview } from './pages/Overview';
import { Findings } from './pages/Findings';
import { Repositories } from './pages/Repositories';
import { Scans } from './pages/Scans';
import { Dependencies } from './pages/Dependencies';
import { Secrets } from './pages/Secrets';
import { Containers } from './pages/Containers';
import { IaC } from './pages/IaC';
import { Experiments } from './pages/Experiments';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Toaster } from 'sonner';

import { AuthProvider } from './context/AuthContext';
import { RepoProvider } from './context/RepoContext';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster theme="dark" position="bottom-right" />
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
      </AuthProvider>
    </Router>
  );
}

export default App;

