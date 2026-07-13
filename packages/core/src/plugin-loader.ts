import type { Capability } from "../../capability-sdk/src/types.js";
import { PlaywrightGeneratorCapability } from "../../capabilities/playwright-generator/src/index.js";
import { createLlmProvider } from "../../llm/src/index.js";
import type { LlmProvider } from "../../llm/src/index.js";
import { CapabilityRegistry } from "./capability-registry.js";

export interface PluginLoadContext {
  llmProvider: LlmProvider;
}

export interface CapabilityPlugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  createCapabilities(context: PluginLoadContext): Capability[];
}

export interface LoadedPlugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly capabilityIds: readonly string[];
}

export interface PluginLoaderOptions {
  llmProvider?: LlmProvider;
}

const BUILT_IN_PLUGINS: readonly CapabilityPlugin[] = [
  {
    id: "builtin.playwright-generator",
    name: "Playwright Generator Plugin",
    version: "0.1.0",
    createCapabilities: ({ llmProvider }) => [
      new PlaywrightGeneratorCapability(llmProvider),
    ],
  },
];

const externalPlugins: CapabilityPlugin[] = [];
let loadedPlugins: LoadedPlugin[] = [];

export function registerExternalPlugin(plugin: CapabilityPlugin): void {
  const plugins = [...BUILT_IN_PLUGINS, ...externalPlugins];

  if (plugins.some((existingPlugin) => existingPlugin.id === plugin.id)) {
    throw new Error(`Plugin "${plugin.id}" is already registered`);
  }

  externalPlugins.push(plugin);
}

export function loadCapabilities(
  options: PluginLoaderOptions = {}
): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  const context: PluginLoadContext = {
    llmProvider: options.llmProvider ?? createLlmProvider(),
  };
  const plugins = [...BUILT_IN_PLUGINS, ...externalPlugins];

  loadedPlugins = plugins.map((plugin) => {
    const capabilities = plugin.createCapabilities(context);

    for (const capability of capabilities) {
      registry.register(capability);
    }

    return {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      capabilityIds: capabilities.map((capability) => capability.id),
    };
  });

  return registry;
}

export function listLoadedPlugins(): readonly LoadedPlugin[] {
  return loadedPlugins.map((plugin) => ({
    ...plugin,
    capabilityIds: [...plugin.capabilityIds],
  }));
}
