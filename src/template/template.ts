/**
 *
 * Part of the MLP r/place Project, under the Apache License v2.0 or ISC.
 * SPDX-License-Identifier: Apache-2.0 OR ISC
 * SPDX-FileCopyrightText: Copyright CONTRIBUTORS.md
 *
 **
 *
 * @file Interface for templates.
 *
 **/

import {gm_fetch, headerStringToObject} from "../utils";

export class TemplatePixels {
  #image: ImageData;
  cacheKey?: string;

  constructor(image: ImageData, cacheKey?: string) {
    this.#image = image;
    this.cacheKey = cacheKey;
  }

  getWidth(): number {
    return this.#image.width;
  }

  getHeight(): number {
    return this.#image.height;
  }

  getImageData(): Uint8ClampedArray {
    return this.#image.data;
  }

  drawTo(canvas: CanvasRenderingContext2D) {
    canvas.putImageData(this.#image, 0, 0);
  }
}

type UpdateResult = 'MaybeChangedCached' | 'MaybeChangedNotCached' | 'NotChanged';

function mergeResponse(current: UpdateResult, resp: GM.Response<any>): UpdateResult {
  const headers = headerStringToObject(resp.responseHeaders);
  if (current == 'MaybeChangedNotCached' || !headers.ETag)
    return 'MaybeChangedNotCached';
  if (current == 'MaybeChangedCached' || resp.status != 304)
    return 'MaybeChangedCached';
  return 'NotChanged';
}

export interface Template {
  template: TemplatePixels;
  mask?: TemplatePixels;

  updateIfDifferent(): Promise<UpdateResult>;
}

export class ImageTemplate implements Template {
  template: TemplatePixels;
  templateURL: URL;
  mask?: TemplatePixels;
  maskURL?: URL;
  width: number;
  height: number;

  private constructor(width: number, height: number, template: TemplatePixels, templateURL: URL,
                      mask?: TemplatePixels, maskURL?: URL) {
    this.template = template;
    this.templateURL = templateURL;
    this.mask = mask;
    this.maskURL = maskURL;
    this.width = width;
    this.height = height;
  }

  private async update(template: TemplatePixels, url: URL) {
    let headers = {};
    if (template.cacheKey)
      headers['If-None-Match'] = template.cacheKey;
    const resp = await ImageTemplate.fetchURL(url, {
      headers: headers
    });
    if (resp.status == 304)
      return 'NotChanged';
    if (resp.status != 200)
      throw resp;
    return {
      template: await ImageTemplate.pixelsFromResponse(resp),
      response: resp
    };
  }

  async updateIfDifferent() {
    let changed: UpdateResult = 'NotChanged';
    const tr = await this.update(this.template, this.templateURL);
    if (tr != 'NotChanged') {
      this.template = tr.template;
      changed = mergeResponse(changed, tr.response);
    }
    if (this.mask) {
      const mr = await this.update(this.mask, this.maskURL!);
      if (mr != 'NotChanged') {
        this.mask = mr.template;
        changed = mergeResponse(changed, mr.response);
      }
    }
    return changed;
  }

  private static async fetchURL(url: URL, req?) {
    return await gm_fetch({
      ...req,
      method: "GET",
      responseType: "arraybuffer",
      url: `${url}?t=${new Date().getTime()}`
    });
  }

  private static async pixelsFromResponse(resp: GM.Response<any>) {
    const bitmap = await createImageBitmap(new Blob([new Uint8ClampedArray(resp.response)]));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0 , 0);
    const imgData = context.getImageData(0, 0, bitmap.width, bitmap.height);
    return new TemplatePixels(imgData, headerStringToObject(resp.responseHeaders).ETag);
  }

  private static async fetchTemplatePixels(URL: URL): Promise<TemplatePixels> {
    const resp = await this.fetchURL(URL);
    if (resp.status != 200)
     throw resp;
    return await this.pixelsFromResponse(resp);
  }

  static async fetchTemplate(templateURL: URL, maskURL?: URL) {
    const template = await this.fetchTemplatePixels(templateURL);
    let mask = maskURL ? await this.fetchTemplatePixels(maskURL) : undefined;
    if (mask && ((mask.getHeight() != template.getHeight()) ||
                 (mask.getWidth() != template.getWidth()))) {
      mask = undefined;
    }
    return new ImageTemplate(template.getWidth(), template.getHeight(), template, templateURL, mask,
                             maskURL);
  }
}
