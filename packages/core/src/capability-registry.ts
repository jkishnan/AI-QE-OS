import type { Capability } from "../../capability-sdk/src/types.js";

export class CapabilityRegistry {
  private capabilities = new Map<string, Capability>();

  register(capability: Capability): void {
    if (this.capabilities.has(capability.id)) {
      throw new Error(
        `Capability "${capability.id}" already exists`
      );
    }

    this.capabilities.set(capability.id, capability);
  }

  get(id: string): Capability {
    const capability = this.capabilities.get(id);

    if (!capability) {
      throw new Error(`Capability "${id}" not found`);
    }

    return capability;
  }

  list(): Capability[] {
    return [...this.capabilities.values()];
  }
}