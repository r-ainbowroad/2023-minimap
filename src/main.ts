/**
 *
 * Part of the MLP r/place Project, under the Apache License v2.0 or ISC.
 * SPDX-License-Identifier: Apache-2.0 OR ISC
 * SPDX-FileCopyrightText: Copyright CONTRIBUTORS.md
 *
 **
 *
 * @file Static overlay bootstrap that loads a template directly from templates.brony.place.
 *
 **/

import {waitForDocumentLoad} from "./canvas";
import {Overlay} from "./overlay";
import {fetchTemplateImage} from "./template/templateImage";
import {waitMs} from "./utils";

const defaultTemplateName = "tyles";
const templateSearchParam = "template";
const targetCanvasId = "chocolate-canvas";
const canvasDetectAttempts = 20;
const canvasDetectRetryDelayMs = 500;

function getTemplateName(): string {
  return new URLSearchParams(window.location.search).get(templateSearchParam) ?? defaultTemplateName;
}

function getTemplateUrl(templateName: string): string {
  return `https://templates.brony.place/${encodeURIComponent(templateName)}/template.png`;
}

async function findCanvas(): Promise<HTMLCanvasElement | null> {
  for (let attempt = 0; attempt < canvasDetectAttempts; attempt++) {
    const canvas = document.getElementById(targetCanvasId);
    if (canvas instanceof HTMLCanvasElement)
      return canvas;

    await waitMs(canvasDetectRetryDelayMs);
  }

  return null;
}

(async function () {
  await waitForDocumentLoad();

  const canvas = await findCanvas();
  if (!canvas) {
    console.error(`Failed to find canvas #${targetCanvasId} to overlay.`);
    return;
  }

  const templateName = getTemplateName();
  const templateUrl = getTemplateUrl(templateName);

  try {
    const template = await fetchTemplateImage(templateUrl);
    new Overlay(canvas, template);
    console.log(`Overlay loaded from ${templateUrl}`);
  } catch (error) {
    console.error(`Failed to load template from ${templateUrl}`, error);
  }
})();
