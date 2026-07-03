import type { Plugin } from "@opencode-ai/plugin"

import { get_interface_map } from "./tool.js"

export const InterfaceMapPlugin: Plugin = async () => {
  return {
    tool: {
      get_interface_map,
    },
  }
}
