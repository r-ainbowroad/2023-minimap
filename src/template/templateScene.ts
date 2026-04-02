/**
 *
 * Part of the MLP r/place Project, under the Apache License v2.0 or ISC.
 * SPDX-License-Identifier: Apache-2.0 OR ISC
 * SPDX-FileCopyrightText: Copyright CONTRIBUTORS.md
 *
 **
 *
 * @file Layer scene model for static template composition.
 *
 **/

export interface TemplateLayerDefinition {
  key: string;
  sources: string[];
  x: number;
  y: number;
}

export interface TemplateLayer extends TemplateLayerDefinition {
  activeSourceKey: string | null;
}

interface TemplateSceneOptions {
  boundsLayerKey?: string;
}

export class TemplateScene {
  private rootLayers: TemplateLayer[];
  private manifestLayers: TemplateLayer[] = [];
  private boundsLayerKey: string;

  constructor(rootLayerDefinitions: TemplateLayerDefinition[], options: TemplateSceneOptions = {}) {
    if (rootLayerDefinitions.length === 0)
      throw new Error("TemplateScene requires at least one root layer.");

    this.rootLayers = rootLayerDefinitions.map((layer) => ({
      ...layer,
      activeSourceKey: null
    }));
    this.boundsLayerKey = options.boundsLayerKey ?? this.rootLayers[this.rootLayers.length - 1].key;
  }

  getBoundsLayer(): TemplateLayer | undefined {
    return this.getLayers().find((layer) => layer.key === this.boundsLayerKey);
  }

  getLayers(): TemplateLayer[] {
    return [...this.manifestLayers, ...this.rootLayers];
  }

  replaceManifestLayers(nextManifestLayerDefinitions: TemplateLayerDefinition[]): boolean {
    const previousActiveSources = new Map(this.manifestLayers.map((layer) => [layer.key, layer.activeSourceKey]));
    const nextManifestLayers = nextManifestLayerDefinitions.map((layer) => ({
      ...layer,
      activeSourceKey: previousActiveSources.get(layer.key) ?? null
    }));

    const changed = !areLayerSetsEqual(this.manifestLayers, nextManifestLayers);
    this.manifestLayers = nextManifestLayers;
    return changed;
  }

  clearManifestLayers(): boolean {
    const changed = this.manifestLayers.length !== 0;
    this.manifestLayers = [];
    return changed;
  }
}

function areLayerSetsEqual(leftLayers: TemplateLayer[], rightLayers: TemplateLayer[]) {
  if (leftLayers.length !== rightLayers.length)
    return false;

  for (let i = 0; i < leftLayers.length; ++i) {
    const leftLayer = leftLayers[i];
    const rightLayer = rightLayers[i];
    if (leftLayer.key !== rightLayer.key)
      return false;
    if (leftLayer.x !== rightLayer.x || leftLayer.y !== rightLayer.y)
      return false;
    if (leftLayer.activeSourceKey !== rightLayer.activeSourceKey)
      return false;
    if (leftLayer.sources.length !== rightLayer.sources.length)
      return false;
    for (let j = 0; j < leftLayer.sources.length; ++j) {
      if (leftLayer.sources[j] !== rightLayer.sources[j])
        return false;
    }
  }

  return true;
}
