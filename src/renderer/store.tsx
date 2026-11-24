import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { produce } from "immer";
import type { Workspace } from "../shared/types";
import { emptyWorkspace, migrate } from "./model";
import { storage } from "./storage";

export type Update = (recipe: (draft: Workspace) => void) => void;
export type SaveState = "saved" | "saving" | "error";

interface WorkspaceContext {
  workspace: Workspace | null;
  loadError: string | null;
  saveState: SaveState;
  workspaceSession: number;
  update: Update;
  restoreBackup(): Promise<boolean>;
}

const Context = createContext<WorkspaceContext | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [workspaceSession, setWorkspaceSession] = useState(0);
  const [restoring, setRestoring] = useState(false);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const saved = useRef<Workspace | null>(null);
  const latest = useRef<Workspace | null>(null);
  const restoreLock = useRef(false);

  useEffect(() => {
    latest.current = workspace;
  }, [workspace]);

  useEffect(() => {
    // The debounced save below is dropped if the window closes inside its delay, so push any unsaved edits out on unload.
    const flush = () => {
      const current = latest.current;
      if (current && current !== saved.current && !restoreLock.current) void storage.saveWorkspace(current);
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, []);

  useEffect(() => {
    storage
      .loadWorkspace()
      .then((loaded) => {
        const initial = loaded ? migrate(loaded) : emptyWorkspace();
        saved.current = initial;
        setWorkspace(initial);
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : String(error)));
  }, []);

  useEffect(() => {
    if (!workspace || workspace === saved.current || restoring) return;
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    setSaveState((state) => (state === "error" ? state : "saving"));
    const timer = setTimeout(() => {
      if (restoreLock.current) return;
      storage.saveWorkspace(workspace).then(
        () => {
          if (!active) return;
          saved.current = workspace;
          setSaveState("saved");
        },
        () => {
          if (!active) return;
          setSaveState("error");
          retry = setTimeout(() => setSaveAttempt((attempt) => attempt + 1), 5000);
        },
      );
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(retry);
    };
  }, [workspace, restoring, saveAttempt]);

  const update = useCallback<Update>((recipe) => {
    if (restoreLock.current) return;
    setWorkspace((current) => (current ? produce(current, recipe) : current));
  }, []);

  const restoreBackup = async () => {
    if (!workspace || restoreLock.current) return false;
    restoreLock.current = true;
    setRestoring(true);
    try {
      const replacement = await storage.restoreBackup(workspace);
      saved.current = replacement;
      setWorkspace(replacement);
      setWorkspaceSession((session) => session + 1);
      setSaveState("saved");
      return true;
    } finally {
      restoreLock.current = false;
      setRestoring(false);
    }
  };

  return <Context.Provider value={{ workspace, loadError, saveState, workspaceSession, update, restoreBackup }}>{children}</Context.Provider>;
}

export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return context;
}
