import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchApi } from '../config';

export interface Repository {
  id: string;
  name: string;
  url: string;
  createdAt: string;
}

interface RepoContextType {
  repositories: Repository[];
  selectedRepo: string; // 'all' or repository name
  setSelectedRepo: (name: string) => void;
  loading: boolean;
  refreshRepositories: () => Promise<void>;
  addRepository: (name: string, url?: string) => Promise<Repository | null>;
}

const RepoContext = createContext<RepoContextType | undefined>(undefined);

export function RepoProvider({ children }: { children: React.ReactNode }) {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialize selectedRepo from URL param or localStorage, fallback to 'all'
  const [selectedRepo, setSelectedRepoState] = useState<string>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const repoFromUrl = urlParams.get('repo');
      if (repoFromUrl) return repoFromUrl;

      const saved = localStorage.getItem('vibeguard_selected_repo');
      if (saved) return saved;
    } catch {}
    return 'all';
  });

  const fetchRepos = async () => {
    try {
      setLoading(true);
      const res = await fetchApi('/api/repositories');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setRepositories(data);
        }
      }
    } catch (err) {
      console.error('Failed to load repositories:', err);
    } finally {
      setLoading(false);
    }
  };

  const addRepository = async (name: string, url?: string): Promise<Repository | null> => {
    try {
      const res = await fetchApi('/api/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url })
      });
      if (res.ok) {
        const newRepo = await res.json();
        await fetchRepos();
        return newRepo;
      }
    } catch (err) {
      console.error('Failed to add repository:', err);
    }
    return null;
  };

  useEffect(() => {
    fetchRepos();
  }, []);

  // Listen to URL search param changes
  useEffect(() => {
    const handleUrlChange = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const repoFromUrl = urlParams.get('repo');
      if (repoFromUrl && repoFromUrl !== selectedRepo) {
        setSelectedRepoState(repoFromUrl);
      }
    };
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [selectedRepo]);

  const setSelectedRepo = (name: string) => {
    setSelectedRepoState(name);
    try {
      localStorage.setItem('vibeguard_selected_repo', name);
      const url = new URL(window.location.href);
      if (name === 'all') {
        url.searchParams.delete('repo');
      } else {
        url.searchParams.set('repo', name);
      }
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };

  return (
    <RepoContext.Provider
      value={{
        repositories,
        selectedRepo,
        setSelectedRepo,
        loading,
        refreshRepositories: fetchRepos,
        addRepository
      }}
    >
      {children}
    </RepoContext.Provider>
  );
}

export function useRepo() {
  const context = useContext(RepoContext);
  if (!context) {
    throw new Error('useRepo must be used within a RepoProvider');
  }
  return context;
}
