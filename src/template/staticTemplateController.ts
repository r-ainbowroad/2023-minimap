/**
 *
 * Part of the MLP r/place Project, under the Apache License v2.0 or ISC.
 * SPDX-License-Identifier: Apache-2.0 OR ISC
 * SPDX-FileCopyrightText: Copyright CONTRIBUTORS.md
 *
 **
 *
 * @file Static template controller with compositing, source polling, and Charity manifest support.
 *
 **/

import EventEmitter from "../EventEmitter";
import {constants} from "../constants";
import {createTemplateImageFromCanvas, TemplateImage} from "./templateImage";
import {ResourceStore} from "./resourceStore";
import {TemplateLayer, TemplateLayerDefinition, TemplateScene} from "./templateScene";

const charitySearchParam = "charity";

interface CharityManifestDocument {
  templates: CharityManifestTemplate[];
  whitelist: string[];
}

interface CharityManifestTemplate {
  key: string;
  sources: string[];
  x: number;
  y: number;
}

interface CharityTemplateDocument {
  templates?: CharityTemplateEntry[];
  whitelist?: CharityWhitelistEntry[];
}

interface CharityTemplateEntry {
  sources?: string[];
  x?: number;
  y?: number;
}

interface CharityWhitelistEntry {
  url?: string;
}

export interface StaticTemplateLayerRoot {
  type: "layer";
  key: string;
  sources: string[];
  x?: number;
  y?: number;
}

export interface StaticTemplateCharityRoot {
  type: "charity";
  url: string;
  ignoreTemplates?: boolean;
}

export type StaticTemplateRoot = StaticTemplateLayerRoot | StaticTemplateCharityRoot;

interface ManifestRoot {
  key: string;
  url: string;
  ignoreTemplates: boolean;
}

interface StaticTemplateControllerOptions {
  boundsLayerKey?: string;
  pollIntervalMs?: number;
}

export function getCharityTemplateUrl(url: URL | Location): string | null {
  const charityUrl = new URLSearchParams(url.search).get(charitySearchParam);
  if (!charityUrl)
    return null;

  try {
    return new URL(charityUrl, url.href).href;
  } catch {
    return null;
  }
}

export class StaticTemplateController extends EventEmitter {
  currentTemplate: TemplateImage | null = null;

  private scene: TemplateScene;
  private manifestRoots: ManifestRoot[];
  private pollIntervalMs: number;
  private resourceStore = new ResourceStore();
  private pollHandle: number | null = null;
  private refreshInFlight = false;

  constructor(roots: StaticTemplateRoot[], options: StaticTemplateControllerOptions = {}) {
    super();
    const rootLayerDefinitions = roots
      .filter((root): root is StaticTemplateLayerRoot => root.type === "layer")
      .map((root) => ({
        key: root.key,
        sources: root.sources
          .map((sourceUrl) => resolveUrl(sourceUrl, window.location.href))
          .filter((sourceUrl): sourceUrl is string => typeof sourceUrl === "string"),
        x: root.x ?? 0,
        y: root.y ?? 0,
      }));
    this.scene = new TemplateScene(rootLayerDefinitions, {
      boundsLayerKey: options.boundsLayerKey
    });
    this.manifestRoots = roots
      .filter((root): root is StaticTemplateCharityRoot => root.type === "charity")
      .map((root) => {
        const resolvedUrl = new URL(root.url, window.location.href).href;
        return {
          key: normalizeManifestUrl(resolvedUrl),
          url: resolvedUrl,
          ignoreTemplates: root.ignoreTemplates ?? false
        };
      });
    this.pollIntervalMs = options.pollIntervalMs ?? constants.ScriptReloadCheckPeriodMs;

    for (const manifestRoot of this.manifestRoots)
      this.resourceStore.getManifestResource<CharityManifestDocument>(manifestRoot.url);
  }

  async start() {
    await this.ensureManifestTrees();
    this.rebuildManifestLayers();
    await this.resolveLayerImages(this.scene.getLayers());
    await this.composeAndPublish();

    if (this.pollHandle === null)
      this.pollHandle = window.setInterval(() => {
        void this.refresh();
      }, this.pollIntervalMs);
  }

  dispose() {
    if (this.pollHandle !== null) {
      window.clearInterval(this.pollHandle);
      this.pollHandle = null;
    }

    this.currentTemplate?.dispose?.();
    this.currentTemplate = null;
    this.resourceStore.dispose();
  }

  private async refresh() {
    if (this.refreshInFlight)
      return;
    this.refreshInFlight = true;

    try {
      let hasUpdates = false;

      if (this.manifestRoots.length > 0) {
        hasUpdates = await this.refreshReachableManifests() || hasUpdates;
        hasUpdates = this.rebuildManifestLayers() || hasUpdates;
      }

      hasUpdates = await this.refreshLayerImageResources(this.scene.getLayers()) || hasUpdates;
      hasUpdates = await this.resolveLayerImages(this.scene.getLayers()) || hasUpdates;

      if (hasUpdates)
        await this.composeAndPublish();
    } catch (error) {
      console.error("Failed to refresh template sources", error);
    } finally {
      this.refreshInFlight = false;
    }
  }

  private async composeAndPublish() {
    const compositeLayers = this.scene.getLayers();
    const boundsLayer = this.scene.getBoundsLayer();
    const boundsImageResource = boundsLayer?.activeSourceKey
      ? this.resourceStore.getImageResourceByKey(boundsLayer.activeSourceKey)
      : null;
    if (!(boundsImageResource?.bitmap instanceof ImageBitmap))
      throw new Error("Bounds layer image not loaded.");

    const compositeCanvas = document.createElement("canvas");
    compositeCanvas.width = boundsImageResource.bitmap.width;
    compositeCanvas.height = boundsImageResource.bitmap.height;
    const compositeContext = compositeCanvas.getContext("2d")!;

    for (const layer of compositeLayers) {
      if (!layer.activeSourceKey)
        continue;

      const imageResource = this.resourceStore.getImageResourceByKey(layer.activeSourceKey);
      if (!(imageResource?.bitmap instanceof ImageBitmap))
        continue;

      compositeContext.drawImage(imageResource.bitmap, layer.x, layer.y);
    }

    const nextTemplate = await createTemplateImageFromCanvas(compositeCanvas);
    const previousTemplate = this.currentTemplate;
    this.currentTemplate = nextTemplate;
    this.emit("update", nextTemplate);
    previousTemplate?.dispose?.();
  }

  private rebuildManifestLayers(): boolean {
    if (this.manifestRoots.length === 0)
      return this.scene.clearManifestLayers();

    const nextLayers: TemplateLayerDefinition[] = [];
    const traverseQueue = [...this.manifestRoots];
    const seenManifests = new Set<string>();

    while (traverseQueue.length > 0) {
      const manifestRoot = traverseQueue.shift()!;
      const manifestKey = manifestRoot.key;
      if (seenManifests.has(manifestKey))
        continue;
      seenManifests.add(manifestKey);

      const manifestResource = this.resourceStore.getManifestResourceByKey<CharityManifestDocument>(manifestKey);
      if (!manifestResource?.manifest)
        continue;

      if (!manifestRoot.ignoreTemplates) {
        for (const template of manifestResource.manifest.templates) {
          nextLayers.push({
            key: template.key,
            sources: template.sources,
            x: template.x,
            y: template.y
          });
        }
      }

      for (const whitelistUrl of manifestResource.manifest.whitelist) {
        traverseQueue.push({
          key: normalizeManifestUrl(whitelistUrl),
          url: whitelistUrl,
          ignoreTemplates: false
        });
      }
    }

    return this.scene.replaceManifestLayers(nextLayers);
  }

  private async resolveLayerImages(layers: TemplateLayer[]): Promise<boolean> {
    let changed = false;

    for (const layer of layers) {
      const previousActiveSourceKey = layer.activeSourceKey;
      const sourceCandidates = previousActiveSourceKey
        ? [
            this.resourceStore.getImageResourceByKey(previousActiveSourceKey)?.url,
            ...layer.sources.filter((sourceUrl) => this.resourceStore.getImageResource(sourceUrl).key !== previousActiveSourceKey)
          ]
        : [...layer.sources];

      layer.activeSourceKey = null;
      for (const sourceUrl of sourceCandidates) {
        if (!sourceUrl)
          continue;

        const imageResource = this.resourceStore.getImageResource(sourceUrl);
        try {
          await this.resourceStore.ensureImageResource(imageResource);
        } catch (error) {
          console.warn(`Failed to load template image ${sourceUrl}`, error);
          continue;
        }

        if (imageResource.bitmap) {
          layer.activeSourceKey = imageResource.key;
          break;
        }
      }

      if (layer.activeSourceKey !== previousActiveSourceKey)
        changed = true;
    }

    return changed;
  }

  private async refreshLayerImageResources(layers: TemplateLayer[]): Promise<boolean> {
    let changed = false;
    const imageResourceKeys = new Set<string>();

    for (const layer of layers) {
      if (layer.activeSourceKey) {
        imageResourceKeys.add(layer.activeSourceKey);
      } else if (layer.sources.length > 0) {
        imageResourceKeys.add(this.resourceStore.getImageResource(layer.sources[0]).key);
      }
    }

    for (const imageResourceKey of imageResourceKeys) {
      const imageResource = this.resourceStore.getImageResourceByKey(imageResourceKey);
      if (!imageResource)
        continue;

      try {
        changed = await this.resourceStore.refreshImageResource(imageResource) || changed;
      } catch (error) {
        console.warn(`Failed to refresh template image ${imageResource.url}`, error);
      }
    }

    return changed;
  }

  private async refreshReachableManifests(): Promise<boolean> {
    if (this.manifestRoots.length === 0)
      return false;

    const queue = [...this.manifestRoots];
    const seenManifests = new Set<string>();
    let changed = false;

    while (queue.length > 0) {
      const manifestRoot = queue.shift()!;
      const manifestKey = manifestRoot.key;
      if (seenManifests.has(manifestKey))
        continue;
      seenManifests.add(manifestKey);

      const manifestResource = this.resourceStore.getManifestResourceByKey<CharityManifestDocument>(manifestKey);
      if (!manifestResource)
        continue;

      try {
        changed = await this.resourceStore.refreshManifestResource(manifestResource, (manifestText, resource) =>
          this.parseManifest(resource.key, resource.url, manifestText)
        ) || changed;
      } catch (error) {
        console.warn(`Failed to refresh charity manifest ${manifestResource.url}`, error);
      }

      for (const whitelistUrl of manifestResource.manifest?.whitelist ?? []) {
        queue.push({
          key: normalizeManifestUrl(whitelistUrl),
          url: whitelistUrl,
          ignoreTemplates: false
        });
      }
    }

    return changed;
  }

  private async ensureManifestTrees() {
    const queue = [...this.manifestRoots];
    const seenManifests = new Set<string>();

    while (queue.length > 0) {
      const manifestRoot = queue.shift()!;
      if (seenManifests.has(manifestRoot.key))
        continue;
      seenManifests.add(manifestRoot.key);

      const manifestResource = this.resourceStore.getManifestResourceByKey<CharityManifestDocument>(manifestRoot.key)
        ?? this.resourceStore.getManifestResource<CharityManifestDocument>(manifestRoot.url);

      try {
        await this.resourceStore.ensureManifestResource(manifestResource, (manifestText, resource) =>
          this.parseManifest(resource.key, resource.url, manifestText)
        );
      } catch (error) {
        console.warn(`Failed to load charity manifest ${manifestResource.url}`, error);
        continue;
      }

      for (const whitelistUrl of manifestResource.manifest?.whitelist ?? []) {
        queue.push({
          key: normalizeManifestUrl(whitelistUrl),
          url: whitelistUrl,
          ignoreTemplates: false
        });
      }
    }
  }

  private parseManifest(manifestKey: string, manifestUrl: string, manifestText: string): CharityManifestDocument {
    const manifest = parseCharityManifest(manifestKey, manifestUrl, manifestText);
    for (const whitelistUrl of manifest.whitelist)
      this.resourceStore.getManifestResource<CharityManifestDocument>(whitelistUrl);
    return manifest;
  }
}

function parseCharityManifest(manifestKey: string, manifestUrl: string, manifestText: string): CharityManifestDocument {
  const manifestJson = JSON.parse(manifestText) as CharityTemplateDocument;
  const templates: CharityManifestTemplate[] = [];
  const whitelist: string[] = [];

  if (manifestJson.templates instanceof Array) {
    manifestJson.templates.forEach((templateEntry, index) => {
      if (typeof templateEntry.x !== "number" || typeof templateEntry.y !== "number")
        return;
      if (!(templateEntry.sources instanceof Array))
        return;

      const sources = templateEntry.sources
        .map((sourceUrl) => resolveUrl(sourceUrl, manifestUrl))
        .filter((sourceUrl): sourceUrl is string => typeof sourceUrl === "string");
      if (sources.length === 0)
        return;

      templates.push({
        key: `${manifestKey}#${index}`,
        sources,
        x: templateEntry.x,
        y: templateEntry.y
      });
    });
  }

  if (manifestJson.whitelist instanceof Array) {
    for (const whitelistEntry of manifestJson.whitelist) {
      const whitelistUrl = resolveUrl(whitelistEntry?.url, manifestUrl);
      if (whitelistUrl)
        whitelist.push(whitelistUrl);
    }
  }

  return {
    templates,
    whitelist
  };
}

function resolveUrl(url: string | undefined, baseUrl: string): string | null {
  if (typeof url !== "string" || !url)
    return null;

  try {
    return new URL(url, baseUrl).href;
  } catch {
    return null;
  }
}

function normalizeManifestUrl(url: string): string {
  const normalizedUrl = new URL(url);
  return `${normalizedUrl.origin}${normalizedUrl.pathname}`;
}
