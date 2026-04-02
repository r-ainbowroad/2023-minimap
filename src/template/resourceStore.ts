/**
 *
 * Part of the MLP r/place Project, under the Apache License v2.0 or ISC.
 * SPDX-License-Identifier: Apache-2.0 OR ISC
 * SPDX-FileCopyrightText: Copyright CONTRIBUTORS.md
 *
 **
 *
 * @file Shared resource cache for template manifests and images.
 *
 **/

import {gm_fetch, headerStringToObject} from "../utils";

interface BaseResource {
  key: string;
  url: string;
  etag?: string;
  request?: Promise<boolean>;
}

export interface ManifestResource<T = unknown> extends BaseResource {
  manifest: T | null;
}

export interface ImageResource extends BaseResource {
  bitmap: ImageBitmap | null;
}

export class ResourceStore {
  private manifestResources = new Map<string, ManifestResource>();
  private imageResources = new Map<string, ImageResource>();

  dispose() {
    for (const imageResource of this.imageResources.values())
      imageResource.bitmap?.close();
  }

  getManifestResource<T = unknown>(url: string): ManifestResource<T> {
    const resolvedUrl = new URL(url).href;
    const manifestKey = normalizeManifestUrl(resolvedUrl);

    let manifestResource = this.manifestResources.get(manifestKey);
    if (!manifestResource) {
      manifestResource = {
        key: manifestKey,
        url: resolvedUrl,
        manifest: null
      };
      this.manifestResources.set(manifestKey, manifestResource);
    }

    return manifestResource as ManifestResource<T>;
  }

  getManifestResourceByKey<T = unknown>(key: string): ManifestResource<T> | undefined {
    return this.manifestResources.get(key) as ManifestResource<T> | undefined;
  }

  getImageResource(url: string): ImageResource {
    const resolvedUrl = new URL(url).href;
    const imageKey = normalizeImageUrl(resolvedUrl);

    let imageResource = this.imageResources.get(imageKey);
    if (!imageResource) {
      imageResource = {
        key: imageKey,
        url: resolvedUrl,
        bitmap: null
      };
      this.imageResources.set(imageKey, imageResource);
    }

    return imageResource;
  }

  getImageResourceByKey(key: string): ImageResource | undefined {
    return this.imageResources.get(key);
  }

  ensureManifestResource<T>(resource: ManifestResource<T>, parseManifest: (manifestText: string, resource: ManifestResource<T>) => Promise<T> | T): Promise<boolean> {
    if (resource.manifest)
      return Promise.resolve(false);
    return this.fetchManifestResource(resource, false, parseManifest);
  }

  refreshManifestResource<T>(resource: ManifestResource<T>, parseManifest: (manifestText: string, resource: ManifestResource<T>) => Promise<T> | T): Promise<boolean> {
    return this.fetchManifestResource(resource, true, parseManifest);
  }

  ensureImageResource(resource: ImageResource): Promise<boolean> {
    if (resource.bitmap)
      return Promise.resolve(false);
    return this.fetchImageResource(resource, false);
  }

  refreshImageResource(resource: ImageResource): Promise<boolean> {
    return this.fetchImageResource(resource, true);
  }

  private fetchManifestResource<T>(resource: ManifestResource<T>, conditional: boolean, parseManifest: (manifestText: string, resource: ManifestResource<T>) => Promise<T> | T): Promise<boolean> {
    if (resource.request)
      return resource.request;

    resource.request = (async () => {
      const headers: Record<string, string> = {};
      if (conditional && resource.etag)
        headers["If-None-Match"] = resource.etag;

      const response = await gm_fetch({
        method: "GET",
        url: resource.url,
        headers
      });

      if (response.status === 304)
        return false;
      if (response.status !== 200)
        throw new Error(`[${response.status}] ${response.statusText}`);

      resource.manifest = await parseManifest(response.responseText, resource);
      resource.etag = headerStringToObject(response.responseHeaders).etag;
      return true;
    })().finally(() => {
      resource.request = undefined;
    });

    return resource.request;
  }

  private fetchImageResource(resource: ImageResource, conditional: boolean): Promise<boolean> {
    if (resource.request)
      return resource.request;

    resource.request = (async () => {
      const headers: Record<string, string> = {};
      if (conditional && resource.etag)
        headers["If-None-Match"] = resource.etag;

      const response = await gm_fetch({
        method: "GET",
        responseType: "arraybuffer",
        url: resource.url,
        headers
      });

      if (response.status === 304)
        return false;
      if (response.status !== 200)
        throw new Error(`[${response.status}] ${response.statusText}`);

      const nextBitmap = await createImageBitmap(new Blob([new Uint8Array(response.response as ArrayBuffer)]));
      resource.bitmap?.close();
      resource.bitmap = nextBitmap;
      resource.etag = headerStringToObject(response.responseHeaders).etag;
      return true;
    })().finally(() => {
      resource.request = undefined;
    });

    return resource.request;
  }
}

function normalizeManifestUrl(url: string): string {
  const normalizedUrl = new URL(url);
  return `${normalizedUrl.origin}${normalizedUrl.pathname}`;
}

function normalizeImageUrl(url: string): string {
  const normalizedUrl = new URL(url);
  return `${normalizedUrl.origin}${normalizedUrl.pathname}${normalizedUrl.search}`;
}
