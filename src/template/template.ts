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

export class TemplatePixels {
  #image: ImageData;

  constructor(image: ImageData) {
    this.#image = image;
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

export interface Template {
  template: TemplatePixels;
  mask?: TemplatePixels;
}

export class ImageTemplate implements Template {
  template: TemplatePixels;
  mask?: TemplatePixels;
  width: number;
  height: number;

  private constructor(width: number, height: number, template: TemplatePixels,
                      mask?: TemplatePixels) {
    this.template = template;
    this.mask = mask;
    this.width = width;
    this.height = height;
  }

  private static async fetchURL(URL: URL): Promise<Uint8ClampedArray> {
    return new Promise((resolve, reject) => {
      GM.xmlHttpRequest({
        method: "GET",
        responseType: "arraybuffer",
        url: `${URL}?t=${new Date().getTime()}`,
        onload: function (res) {
          resolve(new Uint8ClampedArray(res.response));
        },
        onerror: function (res) {
          reject(res);
        },
      });
    });
  }

  private static async fetchTemplatePixels(URL: URL): Promise<TemplatePixels> {
    const data = await this.fetchURL(URL);
    const bitmap = await createImageBitmap(new Blob([data]));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0 , 0);
    const imgData = context.getImageData(0, 0, bitmap.width, bitmap.height);
    return new TemplatePixels(imgData);
  }

  static async fetchTemplate(templateURL: URL, maskURL?: URL) {
    const template = await this.fetchTemplatePixels(templateURL);
    let mask = maskURL ? await this.fetchTemplatePixels(maskURL) : undefined;
    if (mask && ((mask.getHeight() != template.getHeight()) ||
                 (mask.getWidth() != template.getWidth()))) {
      mask = undefined;
    }
    return new ImageTemplate(template.getWidth(), template.getHeight(), template, mask);
  }
}
