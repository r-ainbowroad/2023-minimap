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
}

export async function fetchTemplateImage(url: string): Promise<TemplateImage> {
  const response = await gm_fetch({
    method: "GET",
    responseType: "arraybuffer",
    url
  });

  if (response.status !== 200)
    throw new Error(`[${response.status}] ${response.statusText}`);

  const blob = new Blob([new Uint8Array(response.response as ArrayBuffer)]);
  const bitmap = await createImageBitmap(blob);
  const objectUrl = URL.createObjectURL(blob);
  const template = new StaticTemplateImage(objectUrl, bitmap.width, bitmap.height);
  bitmap.close();
  return template;
}
