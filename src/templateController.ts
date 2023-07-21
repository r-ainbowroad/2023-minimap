import {AsyncWorkQueue, Emitter} from "./utils";
import {ImageTemplate, updateLoop} from "./template/template";

interface MinimapTemplate {
  name: string;
  url: any;
  obj: ImageTemplate | undefined;
}

export class MinimapTemplateController extends Emitter {
  templates = new Map();
  currentTemplate: MinimapTemplate = {
    name: "",
    url: undefined,
    obj: undefined,
  };
  private templateWorkQueue = new AsyncWorkQueue();

  constructor() {
    super();
    const _root = this;
    updateLoop(this.templateWorkQueue, () => { return this.currentTemplate.obj!; }, () => {
      _root.dispatchEvent(new Event("templateFetched"));
    });
  }

  add(name, template) {
    this.templates.set(name, template);
  }

  set(templateName) {
    const template = this.templates.get(templateName);
    if (template === undefined) throw {message: `Invalid /r/place template name: ${templateName}`};
    this.currentTemplate.name = templateName;
    this.currentTemplate.url = template;
  };

  fetch(isAutoPick) {
    const _root = this;
    return this.templateWorkQueue.enqueue(async () => {
      const rPlaceTemplateUrl =
        _root.currentTemplate.url.autoPickUrl !== undefined && isAutoPick
          ? _root.currentTemplate.url.autoPickUrl
          : _root.currentTemplate.url.canvasUrl;
      _root.currentTemplate.obj = await ImageTemplate.fetchTemplate(rPlaceTemplateUrl, _root.currentTemplate.url.maskUrl);
      _root.dispatchEvent(new Event("templateFetched"));
    });
  }

  get keys() {
    return Array.from(this.templates.keys())
  }
}