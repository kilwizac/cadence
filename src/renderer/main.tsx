import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/tiptap/styles.css";
import "@mantine/dropzone/styles.css";
import "@mantine/spotlight/styles.css";
import "@mantine/notifications/styles.css";
import { App } from "./App";
import { WorkspaceProvider } from "./store";
import { theme } from "./theme";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <ModalsProvider>
        <Notifications position="bottom-right" />
        <WorkspaceProvider>
          <App />
        </WorkspaceProvider>
      </ModalsProvider>
    </MantineProvider>
  </StrictMode>,
);
