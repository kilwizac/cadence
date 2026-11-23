import type { OpsApi } from "../shared/api";

declare global {
  interface Window {
    ops?: OpsApi;
  }
}
