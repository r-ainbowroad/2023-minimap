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
const overlayEnabledStorageKey = "enableOverlay";
const localStorageKeyPrefix = "ponyplace-minimap:";

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

async function getStoredValue<T extends GM.Value>(key: string, defaultValue: T): Promise<T> {
  if (typeof GM !== "undefined" && typeof GM.getValue === "function")
    return GM.getValue<T>(key, defaultValue);

  const userscriptApi = globalThis as typeof globalThis & {
    GM_getValue?: <TValue>(key: string, defaultValue?: TValue) => TValue;
  };
  if (typeof userscriptApi.GM_getValue === "function")
    return userscriptApi.GM_getValue(key, defaultValue);

  const storedValue = localStorage.getItem(`${localStorageKeyPrefix}${key}`);
  if (storedValue === null)
    return defaultValue;

  try {
    return JSON.parse(storedValue) as T;
  } catch {
    return defaultValue;
  }
}

async function setStoredValue<T extends GM.Value>(key: string, value: T) {
  if (typeof GM !== "undefined" && typeof GM.setValue === "function") {
    await GM.setValue(key, value);
    return;
  }

  const userscriptApi = globalThis as typeof globalThis & {
    GM_setValue?: <TValue>(key: string, value: TValue) => void;
  };
  if (typeof userscriptApi.GM_setValue === "function") {
    userscriptApi.GM_setValue(key, value);
    return;
  }

  localStorage.setItem(`${localStorageKeyPrefix}${key}`, JSON.stringify(value));
}

function installOverlayToggle(overlay: Overlay, enabled: boolean) {
  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.setAttribute("aria-label", "Toggle template overlay");
  toggleButton.style.position = "fixed";
  toggleButton.style.top = "16px";
  toggleButton.style.right = "16px";
  toggleButton.style.zIndex = "2147483647";
  toggleButton.style.padding = "8px 12px";
  toggleButton.style.border = "1px solid rgba(0, 0, 0, 0.35)";
  toggleButton.style.borderRadius = "8px";
  toggleButton.style.background = "rgba(255, 255, 255, 0.92)";
  toggleButton.style.color = "#111";
  toggleButton.style.font = "600 13px sans-serif";
  toggleButton.style.cursor = "pointer";
  toggleButton.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.18)";
  toggleButton.style.backdropFilter = "blur(4px)";

  const applyState = (nextEnabled: boolean) => {
    if (nextEnabled) {
      overlay.show();
    } else {
      overlay.hide();
    }

    toggleButton.textContent = `Template: ${nextEnabled ? "On" : "Off"}`;
  };

  toggleButton.addEventListener("click", async () => {
    const nextEnabled = toggleButton.textContent?.endsWith("Off") ?? false;
    applyState(nextEnabled);
    await setStoredValue(overlayEnabledStorageKey, nextEnabled);
  });

  applyState(enabled);
  document.body.appendChild(toggleButton);
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
    const overlay = new Overlay(canvas, templateController, templateController.currentTemplate!);
    const overlayEnabled = await getStoredValue(overlayEnabledStorageKey, true);
    installOverlayToggle(overlay, overlayEnabled);
    console.log(`Overlay loaded from ${templateUrl}`);
  } catch (error) {
    console.error(`Failed to load template from ${templateUrl}`, error);
  }
})();
