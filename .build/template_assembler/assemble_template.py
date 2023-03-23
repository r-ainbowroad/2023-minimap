from PIL import Image
import os
import sys
import urllib.request
import json

palettes = [
    [
        (255,255,255),
        (0,0,0),
    ],
]

canvasSize = (2000, 2000)
palette = palettes[0]

imageCache = dict()
def loadTemplateEntryImage(templateEntry):
    imageSources = []
    if "endu" in templateEntry:
        pass # fix
        # this is actually a lot messier since an endu template can come with multiple images in it so some refactoring needs to happen
        # endu templates draw the images in order so the last one takes priority, unlike our format
    elif "images" in templateEntry:
        pass # fix
    else:
        raise KeyError("template entry for {0} needs either images or endu keys".format(templateEntry["name"]))
    
    for imageSource in imageSources:
        try:
            # get from cache or pull and load into cache
            
            # validate image only contains palette colors
            
            return
        except:
            pass
    
    raise RuntimeError("unable to load any images for {0}".format(templateEntry["name"]))

def loadTemplate(templatePath):
    f = open(templatePath, "r", encoding="utf-8")
    template = json.loads(f.read())
    f.close()
    return template

def copyTemplateEntryIntoCanvas():
    pass # fix

def generatePriorityMask():
    pass # fix

def generateEnduImage():
    pass # fix

def updateExtents():
    pass # fix

def writeEnduTemplate():
    pass # fix

def createCanvas():
    pass # fix

def writeCanvas():
    pass # fix

def main(subfolder):
    template = loadTemplate(os.path.join(subfolder, "template.json"))
    
    canvasImage = createCanvas()
    botImage = createCanvas()
    maskImage = createCanvas()
    enduImage = createCanvas()
    
    enduExtents = dict()
    for templateEntry in reversed(template["templates"]):
        print("render {0}".format(templateEntry["name"]))
        with loadTemplateEntryImage(templateEntry) as image:
            copyTemplateEntryIntoCanvas(templateEntry, image, canvasImage)
            
            if ("bots" in templateEntry and bool(templateEntry["bots"])):
                copyTemplateEntryIntoCanvas(templateEntry, image, botImage)
                with generatePriorityMask(templateEntry, image) as priorityMask:
                    copyTemplateEntryIntoCanvas(templateEntry, priorityMask, maskImage)
            
            if ("pony" in templateEntry and bool(templateEntry["pony"])):
                copyTemplateEntryIntoCanvas(templateEntry, image, enduImage)
                updateExtents(templateEntry, image, enduExtents)
    
    writeCanvas(canvasImage, subfolder, "canvas", indexed = True)
    writeCanvas(botImage, subfolder, "bot", indexed = True)
    writeCanvas(maskImage, subfolder, "mask")
    
    with generateEnduImage(enduImage, enduExtents) as enduCrop:
        writeCanvas(enduCrop, subfolder, "endu", indexed = True)
        writeEnduTemplate(enduExtents, subfolder)
    
    canvasImage.close()
    botImage.close()
    maskImage.close()
    enduImage.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Must provide the folder to run in relative to repo root")
    if not os.path.isfile(".build/template_assembler/assemble_template.py"):
        print("Must be invoked from repo root")
    main(sys.argv[1])