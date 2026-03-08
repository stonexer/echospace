import { useCallback, useEffect, useRef, useState } from 'react';
import { toast, Toaster } from 'sonner';
import { useStore } from 'zustand';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { FileList } from '../components/file-list/FileList';
import { TabBar } from '../components/tab-bar/TabBar';
import { ThreadEditor } from '../components/editor/ThreadEditor';
import { StatusBar } from '../components/status-bar/StatusBar';
import { createThreadStore } from '../stores/thread-store';
import { createWorkspaceStore } from '../stores/workspace-store';
import { createPluginStore } from '../stores/plugin-store';
import { StoreContext } from '../lib/store-context';
import { htmlRendererPlugin } from '~/core/plugins';
import { detectFormat, smartParse } from '~/core/smart-paste';
import { serializeEcho } from '~/core/echo';
import { nanoid } from 'nanoid';
import { initTheme } from '../lib/theme';

initTheme();

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
  const pluginStore = useRef(createPluginStore()).current;
  const workspace = useStore(workspaceStore);
  const activeFile = useStore(workspaceStore, (s) => s.activeFile);

  // Register built-in plugins
  useEffect(() => {
    pluginStore.getState().registerPlugin(htmlRendererPlugin);
  }, []);

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

  // Import content: create .echo file from raw NDJSON or convert from other formats
  const importContent = useCallback(async (text: string, sourceFilename?: string) => {
    const format = detectFormat(text);

    let ndjson: string;
    let title = sourceFilename?.replace(/\.(echo|json)$/i, '') ?? `pasted-${nanoid(6)}`;

    if (format === 'echo') {
      ndjson = text;
      if (!sourceFilename) {
        try {
          const meta = JSON.parse(text.split('\n')[0]);
          if (meta.title) title = meta.title;
        } catch { /* use default */ }
      }
    } else if (format === 'unknown') {
      return false;
    } else {
      // Convert any recognized format (openai, anthropic, google, vercel, raw) to echo
      const messages = smartParse(text);
      if (messages.length === 0) return false;

      // Try to extract model info for meta settings
      let model: string | undefined;
      try {
        const parsed = JSON.parse(text);
        model = parsed.response?.model ?? parsed.model;
      } catch { /* ignore */ }

      ndjson = serializeEcho({
        meta: {
          kind: 'meta',
          v: 1,
          id: crypto.randomUUID().slice(0, 8),
          title,
          created_at: new Date().toISOString(),
          settings: model ? { model } : undefined,
        },
        messages,
      });
    }

    const safeName = title.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fff]/g, '_').slice(0, 60);
    let filename = `${safeName}.echo`;

    // Retry with incremented suffix if file already exists
    let ok = await workspaceStore.getState().createFileFromRaw(filename, ndjson);
    if (!ok) {
      for (let i = 2; i <= 99; i++) {
        filename = `${safeName}_${i}.echo`;
        ok = await workspaceStore.getState().createFileFromRaw(filename, ndjson);
        if (ok) break;
      }
    }

    if (ok) {
      toast.success(`Imported as ${filename}`);
    } else {
      toast.error('Failed to create file');
    }
    return ok;
  }, []);

  // Global paste: detect .echo NDJSON and create a new file
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const text = e.clipboardData?.getData('text/plain')?.trim();
      if (!text) return;

      const fmt = detectFormat(text);
      if (fmt !== 'unknown') {
        e.preventDefault();
        await importContent(text);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [importContent]);

  // Global drag-and-drop: import .echo files
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (!files?.length) return;

      for (const file of Array.from(files)) {
        if (!file.name.endsWith('.echo') && !file.name.endsWith('.json')) continue;
        const text = await file.text();
        await importContent(text, file.name);
      }
    };

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);
    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [importContent]);

  const showSidebar = isSmallScreen ? sidebarOpen : true;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const sidebarContent = (
    <FileList
      files={workspace.files}
      activeFile={workspace.activeFile}
      onSelect={handleFileSelect}
      onCreate={workspace.createFile}
      onDelete={workspace.deleteFile}
      isLoading={workspace.isLoading}
    />
  );

  const editorContent = (
    <div className="flex h-full flex-col overflow-hidden">
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Tab bar */}
        <TabBar />

        {/* Content */}
        {activeFile ? (
          <ThreadEditor />
        ) : (
          <div className="flex flex-1 items-center justify-center bg-bg-1-1">
            <div className="text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="131 131 250 250"
                width="40"
                height="40"
                className="mx-auto"
              >
                <style>{`
                  @keyframes es-spin-in-cw {
                    0% { transform: scale(0) rotate(-45deg); opacity: 0; }
                    60% { opacity: 1; }
                    100% { transform: scale(1) rotate(0deg); opacity: 1; }
                  }
                  @keyframes es-spin-in-ccw {
                    0% { transform: scale(0) rotate(45deg); opacity: 0; }
                    60% { opacity: 1; }
                    100% { transform: scale(1) rotate(0deg); opacity: 1; }
                  }
                  .es-entrance-outer {
                    transform-origin: 256px 256px;
                    opacity: 0;
                    animation: es-spin-in-cw 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.1s forwards;
                  }
                  .es-entrance-inner {
                    transform-origin: 256px 256px;
                    opacity: 0;
                    animation: es-spin-in-ccw 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.25s forwards;
                  }
                `}</style>
                <g className="es-entrance-outer">
                  <rect x="139.3" y="139.3" width="233.3" height="233.3" rx="36.7" ry="36.7" fill="#BB4B03" />
                  <rect x="168" y="168" width="176" height="176" rx="25" ry="25" fill="#F2E2C1" />
                </g>
                <g className="es-entrance-inner">
                  <rect x="198" y="198" width="116" height="116" rx="18.3" ry="18.3" fill="#BB4B03" />
                  <rect x="226.3" y="226.3" width="59.3" height="59.3" rx="9.3" ry="9.3" fill="#F2E2C1" />
                </g>
              </svg>
              <div className="mt-2.5 font-serif text-[18px] text-text-secondary">
                EchoSpace
              </div>
              <div className="mt-1.5 text-[13px] text-text-desc">
                Open or create an .echo file to start
              </div>
            </div>
          </div>
        )}
      </main>
      <StatusBar />
    </div>
  );

  const sidebarPanelRef = useRef<import('react-resizable-panels').ImperativePanelHandle>(null);

  return (
    <StoreContext.Provider value={{ workspaceStore, threadStore, pluginStore }}>
      <div className="flex h-screen w-screen overflow-hidden">
          {isSmallScreen ? (
            <>
              {/* Sidebar toggle for small screens */}
              {!sidebarOpen && (
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

              {/* Overlay backdrop */}
              {sidebarOpen && (
                <div
                  className="fixed inset-0 z-20 bg-black/20"
                  onClick={() => setSidebarOpen(false)}
                />
              )}

              {/* Sidebar overlay */}
              {showSidebar && (
                <div className="fixed inset-y-0 left-0 z-30 flex shadow-lg">
                  {sidebarContent}
                  <div className="w-px bg-border" />
                </div>
              )}

              {editorContent}
            </>
          ) : (
            <PanelGroup direction="horizontal">
              <Panel
                ref={sidebarPanelRef}
                defaultSize={18}
                minSize={12}
                maxSize={30}
                collapsible
                collapsedSize={0}
                onCollapse={() => setSidebarCollapsed(true)}
                onExpand={() => setSidebarCollapsed(false)}
              >
                {sidebarContent}
              </Panel>

              <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-primary/40 active:bg-primary/60" />

              {/* Collapsed sidebar toggle */}
              {sidebarCollapsed && (
                <button
                  onClick={() => sidebarPanelRef.current?.expand()}
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

              <Panel defaultSize={82} minSize={50}>
                {editorContent}
              </Panel>
            </PanelGroup>
          )}

        <Toaster
          theme="light"
          toastOptions={{
            style: {
              background: 'var(--bg-1-1)',
              border: '1px solid var(--border-1)',
              color: 'var(--text-normal)',
              fontSize: '12.5px',
              fontFamily: 'Geist, sans-serif'
            }
          }}
        />
      </div>
    </StoreContext.Provider>
  );
}
