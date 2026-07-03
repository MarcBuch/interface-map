import { tool } from "@opencode-ai/plugin"

import { getInterfaceMapText } from "./interface-map.js"

export const get_interface_map = tool({
  description: "Extract a plain-text interface map from a TypeScript source file.",
  args: {
    filePath: tool.schema.string().describe("Path to the TypeScript source file"),
  },
  async execute(args) {
    return await getInterfaceMapText(args.filePath)
  },
})
