import { describe, expect, test } from "bun:test"

import InterfaceMapPluginDefault, { InterfaceMapPlugin } from "../src"
import { getInterfaceMapTextFromSource } from "../src/interface-map"
import { get_interface_map } from "../src/tool"

describe("getInterfaceMapTextFromSource", () => {
  test("summarizes zod objects, route paths, plain objects, and export defaults", async () => {
    const output = await getInterfaceMapTextFromSource(`
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

const schema = z.object({
  id: z.string(),
  nested: z.object({
    hidden: z.boolean(),
  }),
}).extend({
  extra: z.number(),
})

const route = createFileRoute("/users/$userId")({
  component: UserRoute,
})

const settings = {
  alpha: 1,
  beta: true,
}

export default function App() {
  return null
}
`)

    expect(output).toMatch(/const schema = z\.object\(\{ id, nested \}\)\.extend\(\{ extra \}\)/s)
    expect(output).toMatch(/const route = createFileRoute\("\/users\/\$userId"\)\(\{ component \}\)/)
    expect(output).toMatch(/const settings = \{ alpha, beta \}/)
    expect(output).toMatch(/export default function App\(\) \{\}/)
    expect(output).not.toContain(`hidden`)
    expect(output).not.toContain(`return null`)
  })

  test("summarizes direct object-literal type aliases by keys", async () => {
    const output = await getInterfaceMapTextFromSource(`
type Config = {
  alpha: string
  beta(): void
}
`)

    expect(output).toContain(`type Config = { alpha, beta }`)
  })

  test("falls back safely for non-object type aliases", async () => {
    const output = await getInterfaceMapTextFromSource(`
type Result = string | number
`)

    expect(output).toContain(`type Result = string | number`)
  })

  test("numbers source nodes, expands declarations, and omits nested implementation bodies", async () => {
    const output = await getInterfaceMapTextFromSource(`
export declare namespace Api {
  interface Client {
    id: string
  }

  const value: string
}

export class Service {
  constructor(private readonly name: string) {}

  run() {
    type Hidden = { ok: true }
    function nested() {
      return Hidden
    }
    return nested()
  }
}

const a = 1, b = 2

declare module "foo" {
  export interface Config {
    enabled: boolean
  }
}
`)

    expect(output).toMatch(/export declare namespace Api \{[\s\S]*interface Client \{[\s\S]*id: string[\s\S]*const value: string[\s\S]*\}/s)
    expect(output).toMatch(/export class Service \{[\s\S]*constructor\(private readonly name: string\);[\s\S]*\}/s)
    expect(output).toMatch(/const a = 1[\s\S]*const b = 2/s)
    expect(output).toMatch(/declare module "foo" \{[\s\S]*export interface Config \{[\s\S]*enabled: boolean[\s\S]*\}/s)
    expect(output).not.toContain(`Hidden`)
    expect(output).not.toContain(`nested()`)
    expect(output).not.toContain(`return nested()`)
  })

  test("registers the opencode tool from the plugin entrypoint", async () => {
    const plugin = await InterfaceMapPlugin({} as never)

    expect(plugin.tool?.get_interface_map).toBe(get_interface_map)
  })

  test("exports the plugin entrypoint as the default export", () => {
    expect(InterfaceMapPluginDefault).toBe(InterfaceMapPlugin)
  })
})
