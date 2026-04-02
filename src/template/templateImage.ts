/**
 *
 * Part of the MLP r/place Project, under the Apache License v2.0 or ISC.
 * SPDX-License-Identifier: Apache-2.0 OR ISC
 * SPDX-FileCopyrightText: Copyright CONTRIBUTORS.md
 *
 **
 *
 * @file Static template image helpers for direct overlay loading.
 *
 **/

import {gm_fetch} from "../utils";

export interface TemplateImage {
  width: number;
  height: number;
  src: string;
  dispose?(): void;
}

class StaticTemplateImage implements TemplateImage {
  src: string;
  width: number;
  height: number;

  constructor(src: string, width: number, height: number) {
    this.src = src;
    this.width = width;
    this.height = height;
  }

  dispose() {
    if (this.src.startsWith("blob:"))
      URL.revokeObjectURL(this.src);
  }
}

async function fetchTemplateBlob(url: string): Promise<Blob> {
  const response = await gm_fetch({
    method: "GET",
    responseType: "arraybuffer",
    url
  });

  if (response.status !== 200)
    throw new Error(`[${response.status}] ${response.statusText}`);

  return new Blob([new Uint8Array(response.response as ArrayBuffer)]);
}

export async function fetchTemplateBitmap(url: string): Promise<ImageBitmap> {
  return createImageBitmap(await fetchTemplateBlob(url));
}

export async function fetchTemplateImage(url: string): Promise<TemplateImage> {
  const blob = await fetchTemplateBlob(url);
  const bitmap = await createImageBitmap(blob);
  const objectUrl = URL.createObjectURL(blob);
  const template = new StaticTemplateImage(objectUrl, bitmap.width, bitmap.height);
  bitmap.close();
  return template;
}

export async function createTemplateImageFromCanvas(canvas: HTMLCanvasElement): Promise<TemplateImage> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((generatedBlob) => {
      if (generatedBlob)
        resolve(generatedBlob);
      else
        reject(new Error("Failed to render template canvas."));
    }, "image/png");
  });

  return new StaticTemplateImage(URL.createObjectURL(blob), canvas.width, canvas.height);
}
