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
  update: Update;
}

const Context = createContext<WorkspaceContext | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const hydrated = useRef<Workspace | null>(null);

  useEffect(() => {
    storage
      .loadWorkspace()
      .then((loaded) => {
        const initial = loaded ? migrate(loaded) : emptyWorkspace();
        hydrated.current = initial;
        setWorkspace(initial);
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : String(error)));
  }, []);

  useEffect(() => {
    if (!workspace || workspace === hydrated.current) return;
    setSaveState("saving");
    const timer = setTimeout(() => {
      storage.saveWorkspace(workspace).then(
        () => setSaveState("saved"),
        () => setSaveState("error"),
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [workspace]);

  const update = useCallback<Update>((recipe) => {
    setWorkspace((current) => (current ? produce(current, recipe) : current));
  }, []);

  return <Context.Provider value={{ workspace, loadError, saveState, update }}>{children}</Context.Provider>;
}

export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return context;
}
