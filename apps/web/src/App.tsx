import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import HeroDemo from '@/components/ui/demo';
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
import { Placeholder } from './pages/Placeholder';
import { Toaster } from 'sonner';

import { RepoProvider } from './context/RepoContext';

function App() {
  return (
    <Router>
      <Toaster theme="dark" position="bottom-right" />
      <Routes>
        {/* Landing Page with SaaS Template */}
        <Route path="/" element={<Landing />} />
        <Route path="/demo" element={<HeroDemo />} />

        {/* Dashboard Pages with Sidebar Layout */}
        <Route
          path="/*"
          element={
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
                </Routes>
              </Layout>
            </RepoProvider>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
