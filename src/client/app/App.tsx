import { useCallback, useEffect, useRef, useState } from 'react';
import { Toaster } from 'sonner';
import { useStore } from 'zustand';
import { FileList } from '../components/file-list/FileList';
import { TabBar } from '../components/tab-bar/TabBar';
import { ThreadEditor } from '../components/editor/ThreadEditor';
import { StatusBar } from '../components/status-bar/StatusBar';
import { createThreadStore } from '../stores/thread-store';
import { createWorkspaceStore } from '../stores/workspace-store';
import { StoreContext } from '../lib/store-context';

const SMALL_SCREEN_BREAKPOINT = 720;

function useIsSmallScreen() {
  const [isSmall, setIsSmall] = useState(
    () => window.innerWidth < SMALL_SCREEN_BREAKPOINT
  );

  useEffect(() => {
    const mq = window.matchMedia(
      `(max-width: ${SMALL_SCREEN_BREAKPOINT - 1}px)`
    );
    const handler = (e: MediaQueryListEvent) => setIsSmall(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isSmall;
}

export function App() {
  const workspaceStore = useRef(createWorkspaceStore()).current;
  const threadStore = useRef(createThreadStore()).current;
  const workspace = useStore(workspaceStore);
  const activeFile = useStore(workspaceStore, (s) => s.activeFile);

  const isSmallScreen = useIsSmallScreen();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on file select when on small screen
  const handleFileSelect = useCallback(
    (path: string) => {
      workspace.setActiveFile(path);
      if (isSmallScreen) setSidebarOpen(false);
    },
    [workspace.setActiveFile, isSmallScreen]
  );

  useEffect(() => {
    workspace.loadFiles();
  }, []);

  useEffect(() => {
    if (activeFile) {
      threadStore.getState().loadFile(activeFile);
    }
  }, [activeFile]);

  const showSidebar = isSmallScreen ? sidebarOpen : true;

  return (
    <StoreContext.Provider value={{ workspaceStore, threadStore }}>
      <div className="flex h-screen w-screen flex-col overflow-hidden">
        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar toggle for small screens */}
          {isSmallScreen && !sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex w-7 shrink-0 flex-col items-center justify-start border-r border-border bg-bg-1 pt-2 transition-colors hover:bg-bg-1-2"
              title="Open file list"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              >
                <path d="M2 4h10M2 7h10M2 10h10" />
              </svg>
            </button>
          )}

          {/* Overlay backdrop for small screens */}
          {isSmallScreen && sidebarOpen && (
            <div
              className="fixed inset-0 z-20 bg-black/20"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          {showSidebar && (
            <div
              className={
                isSmallScreen
                  ? 'fixed inset-y-0 left-0 z-30 flex shadow-lg'
                  : 'flex'
              }
            >
              <FileList
                files={workspace.files}
                activeFile={workspace.activeFile}
                onSelect={handleFileSelect}
                onCreate={workspace.createFile}
                onDelete={workspace.deleteFile}
                isLoading={workspace.isLoading}
              />
              <div className="w-px bg-border" />
            </div>
          )}

          {/* Resizable divider (large screens only, when sidebar not overlaying) */}
          {!isSmallScreen && <div className="w-px bg-border" />}

          {/* Editor area */}
          <main className="flex flex-1 flex-col overflow-hidden">
            {/* Tab bar */}
            <TabBar />

            {/* Content */}
            {activeFile ? (
              <ThreadEditor />
            ) : (
              <div className="flex flex-1 items-center justify-center bg-bg-1-1">
                <div className="text-center">
                  <div className="font-serif text-[16px] italic text-text-secondary">
                    EchoSpace
                  </div>
                  <div className="mt-1.5 text-[12px] text-text-desc">
                    Open or create an .echo file to start
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Status bar */}
        <StatusBar />

        <Toaster
          theme="light"
          toastOptions={{
            style: {
              background: '#f5f1e9',
              border: '1px solid #d8d0c2',
              color: '#2e2720',
              fontSize: '12.5px',
              fontFamily: 'DM Sans, sans-serif'
            }
          }}
        />
      </div>
    </StoreContext.Provider>
  );
}
