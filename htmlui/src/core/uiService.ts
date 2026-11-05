import { clientGet } from "./clientApiFetch";
import type { ApiResponse } from "./types";

export type PathSelectionOptions = {
  kind: "directory" | "file" | "save-file";
  defaultPath?: string;
  extension?: "zip" | "tar";
};

declare global {
  interface Window {
    kopiaUI?: {
      updateAndShutdown?: () => Promise<boolean>;
      selectPath?: (options: PathSelectionOptions) => Promise<string | null>;
      selectDirectory?: (onSelected: (path: string | null) => void) => void;
      browseDirectory?: (path: string) => Promise<string>;
    };
  }
}

export type Instance = {
  id: string;
  name: string;
  default: boolean;
};

export const isKopiaEmbedded = import.meta.env.MODE === "kopia";

function getInstances(): Promise<ApiResponse<Instance[]>> {
  if (isKopiaEmbedded) {
    return Promise.resolve({
      isError: false,
      data: [{ id: "main", name: "Kopia", default: true }],
      responseCode: 200
    });
  }

  return clientGet("/instances");
}
const methods = {
  getInstances
};

export default methods;
