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
import {AutoColorPicker} from "./autoColorPicker";
import {Overlay} from "./overlay";
import {getCharityTemplateUrl, StaticTemplateController, StaticTemplateRoot} from "./template/staticTemplateController";
import {waitMs} from "./utils";

const defaultTemplateName = "tyles";
const templateSearchParam = "template";
const targetCanvasId = "chocolate-canvas";
const canvasDetectAttempts = 20;
const canvasDetectRetryDelayMs = 500;
const defaultCharityTemplateUrl = "https://templates.brony.place/tyles/charity.json";

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
  const explicitCharityUrl = getCharityTemplateUrl(window.location);
  const charityUrl = explicitCharityUrl ?? defaultCharityTemplateUrl;
  const templateRoots: StaticTemplateRoot[] = [
    {
      type: "layer",
      key: "primary",
      sources: [templateUrl]
    },
    {
      type: "charity",
      url: charityUrl,
      ignoreTemplates: !explicitCharityUrl && charityUrl === defaultCharityTemplateUrl
    }
  ];

  try {
    const templateController = new StaticTemplateController(templateRoots, {
      boundsLayerKey: "primary"
    });
    await templateController.start();
    await new AutoColorPicker(templateController).start();
    new Overlay(canvas, templateController, templateController.currentTemplate!);
    console.log(`Overlay loaded from ${templateUrl}`);
  } catch (error) {
    console.error(`Failed to load template from ${templateUrl}`, error);
  }
})();
