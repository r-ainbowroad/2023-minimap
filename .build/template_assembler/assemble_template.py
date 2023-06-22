from PIL import Image, ImageDraw
import os
import sys
import urllib.request
import urllib.parse
import json
import datetime
import math

palettes = [
    set([ # 2k x 2k palette from 2022
        (180,  74, 192, 255),
        (0,   163, 104, 255),
        (54,  144, 234, 255),
        (109,   0,  26, 255),
        (156, 105,  38, 255),
        (73,   58, 193, 255),
        (255,  56, 129, 255),
        (137, 141, 144, 255),
        (255, 180, 112, 255),
        (126, 237,  86, 255),
        (109,  72,  47, 255),
        (222,  16, 127, 255),
        (0,     0,   0, 255),
        (148, 179, 255, 255),
        (0,   204, 120, 255),
        (0,   117, 111, 255),
        (255, 248, 184, 255),
        (0,   158, 170, 255),
        (228, 171, 255, 255),
        (255, 153, 170, 255),
        (129,  30, 159, 255),
        (255, 255, 255, 255),
        (0,   204, 192, 255),
        (137, 141, 144, 255),
        (212, 215, 217, 255),
        (255,  69,   0, 255),
        (81,  233, 244, 255),
        (81,   82,  82, 255),
        (190,   0,  57, 255),
        (106,  92, 255, 255),
        (255, 214,  53, 255),
        (255, 168,   0, 255),
        (255, 255, 255, 255),
        (36,   80, 164, 255),
    ]),
]

canvasSize = (1000, 1000)
palette = palettes[0]

def loadTemplate(subfolder):
    with open(os.path.join(subfolder, "template.json"), "r", encoding="utf-8") as f:
        template = json.loads(f.read())
    return template


def createImage(size, isMask):
    alphaValue = 0
    if isMask:
        alphaValue = 255
    return Image.new("RGBA", size, (0, 0, 0, alphaValue)) 

def createCanvas(isMask = False):
    return createImage(canvasSize, isMask)

def copyTemplateEntryIntoCanvas(templateEntry, image, canvas):
    if (templateEntry["x"] + image.width > canvasSize[0] or
        templateEntry["y"] + image.height > canvasSize[1] or
        templateEntry["x"] < 0 or
        templateEntry["y"] < 0):
        raise ValueError("{0} is not entirely on canvas??".format(templateEntry["name"]))
    
    canvas.alpha_composite(image, (templateEntry["x"], templateEntry["y"]))

def eraseFromCanvas(templateEntry, maskImage, canvas, isMask = False):
    blankImage = createImage((maskImage.width, maskImage.height), isMask)
    canvas.paste(blankImage, (templateEntry["x"], templateEntry["y"]), maskImage)

def writeCanvas(canvas, subfolder, name):
    canvas.save(os.path.join(subfolder, name + ".png"))
    if False:
        canvas.save(os.path.join(subfolder, name + "_u.png"))
        with canvas.quantize() as quantizedCanvas:
            quantizedCanvas.save(os.path.join(subfolder, name + ".png"))

def colorDistance(color, pixel):
    elementDeltaSquares = [(colorElement - pixelElement) ** 2 for colorElement, pixelElement in zip(color, pixel)]
    return math.sqrt(sum(elementDeltaSquares))

def normalizeImage(convertedImage):
    fixedPixels = 0
    wrongPixels = set()
    
    for y in range(0, convertedImage.height):
        for x in range(0, convertedImage.width):
            xy = (x, y)
            pixel = convertedImage.getpixel(xy)
            
            if isTransparent(pixel):
                convertedImage.putpixel(xy, (0, 0, 0, 0))
                continue
            
            if pixel in palette:
                continue
            
            newDelta = 99999999
            newColor = None
            for color in palette:
                colorDelta = colorDistance(color, pixel)
                if colorDelta < newDelta:
                    newColor = color
                    newDelta = colorDelta
            
            fixedPixels += 1
            wrongPixels.add((pixel, newColor))
            convertedImage.putpixel(xy, newColor)
    print("\tfixed " + str(fixedPixels) + " incorrect pixels")
    for pixel in wrongPixels:
        print("\t\t" + str(pixel))

def loadTemplateEntryImage(templateEntry, subfolder):
    for imageSource in templateEntry["images"]:
        try:
            if imageSource.startswith("http"):
                headers = {
                    "User-Agent": "test script (http://www.example.com, 0)",
                }
                request = urllib.request.Request(imageSource, headers = headers, method = "GET")
                responseObject = urllib.request.urlopen(request, timeout=5)
                rawImage = Image.open(responseObject)
            else:
                rawImage = Image.open(os.path.join(subfolder, imageSource))
            
            convertedImage = Image.new("RGBA", (rawImage.width, rawImage.height))
            convertedImage.paste(rawImage)

            rawImage.close()
            
            normalizeImage(convertedImage)
            
            return convertedImage
        except Exception as e:
            print("Eat exception {0}".format(e))
    
    raise RuntimeError("unable to load any images for {0}".format(templateEntry["name"]))

def resolveTemplateFileEntry(templateFileEntry):
    requiredProperties = ["name", "x", "y"]
    if "endu" in templateFileEntry:
        target = templateFileEntry["endu"]
        responseObject = urllib.request.urlopen(target, timeout=5)
        enduTemplate = json.loads(responseObject.read().decode("utf-8"))
        
        output = []
        for enduTemplateEntry in enduTemplate["templates"]:
            for requiredProperty in requiredProperties:
                if not requiredProperty in enduTemplateEntry:
                    print("Missing required property {1} from {0}".format(templateFileEntry["name"], requiredProperty))
                    raise KeyError()
            
            localName = templateFileEntry["name"] + " -> " + enduTemplateEntry["name"]
            if not "sources" in enduTemplateEntry:
                print("Missing sources for {0}".format(localName))
                raise KeyError()
            
            if "frameRate" in enduTemplateEntry:
                print("Ignoring animated template {0}".format(localName))
                continue
            
            converted = {
                "name": localName,
                "images": enduTemplateEntry["sources"],
                "x": enduTemplateEntry["x"],
                "y": enduTemplateEntry["y"]
            }
            
            for copyProperty in ["pony", "autopick", "priority"]:
                if copyProperty in templateFileEntry:
                    converted[copyProperty] = templateFileEntry[copyProperty]
            
            output.append(converted)
        return output
    elif "images" in templateFileEntry:
        for requiredProperty in requiredProperties:
            if not requiredProperty in templateFileEntry:
                # going to make a bad assumption that name is provided...
                print("Missing required property {1} from {0}".format(templateFileEntry["name"], requiredProperty))
                raise KeyError()
        return [templateFileEntry]
    else:
        raise KeyError("template entry for {0} needs either images or endu keys".format(templateEntry["name"]))


def getSurroundingPixels(xy):
    (x, y) = xy
    return [
        (x-1, y-1),
        (x, y-1),
        (x+1, y-1),
        (x-1, y),
        (x+1, y),
        (x-1, y+1),
        (x, y+1),
        (x+1, y+1)
    ]

def isFilledPixelOnEdge(image, knownTransparent, xy):
    (x, y) = xy
    if x == 0 or y == 0 or x == image.width - 1 or y == image.height - 1:
        return True
    
    try:
        if y == 1:
            pixelsToSample = [
                (x+1, y),
                (x-1, y+1),
                (x, y+1),
                (x+1, y+1)
            ]
        elif x == 1:
            pixelsToSample = [
                (x-1, y+1),
                (x, y+1),
                (x+1, y+1)
            ]
        else:
            pixelsToSample = [
                (x+1, y+1)
            ]
        
        justExit = False
        for pixel in pixelsToSample:
            if isTransparent(image.getpixel(pixel)):
                knownTransparent.add(pixel)
                justExit = True
        
        if justExit:
            return True

        for neighbor in getSurroundingPixels(xy):
            if neighbor in knownTransparent:
                return True
        return False
    except:
        print(xy, image.width, image.height)
        raise

def isTransparent(pixelTuple):
    return pixelTuple[3] < 128

def generatePriorityMask(templateEntry, image):
    priority = 1
    if "priority" in templateEntry:
        priority = int(templateEntry["priority"])
        if priority < 1 or priority > 10:
            raise ValueError("{0} priority out of acceptable range".format(templateEntry["name"]))
        
    priority *= 23
    mask = Image.new("RGBA", (image.width, image.height), (0, 0, 0, 0))
    maskDraw = ImageDraw.Draw(mask)
    
    knownTransparent = set()
    edgePixels = set()
    innerPixels = set()
    
    for y in range(0, image.height):
        for x in range(0, image.width):
            xy = (x, y)
            
            if (xy in knownTransparent):
                continue
            
            if isTransparent(image.getpixel(xy)):
                knownTransparent.add(xy)
                maskDraw.point(xy, (0, 0, 0, 0))
                continue
            
            if isFilledPixelOnEdge(image, knownTransparent, xy):
                edgePixels.add(xy)
            else:
                innerPixels.add(xy)
    
    for iteration in range(0,6):
        currentPriority = priority + 25 - iteration * 5
        pixelTuple = (currentPriority, currentPriority, currentPriority, 255)
        
        newEdgePixels = set()
        for edgePixel in edgePixels:
            maskDraw.point(edgePixel, pixelTuple)
            for neighbor in getSurroundingPixels(edgePixel):
                if neighbor in innerPixels:
                    newEdgePixels.add(neighbor)
                    innerPixels.remove(neighbor)
        edgePixels = newEdgePixels

    innerPixels.update(edgePixels)
    pixelTuple = (priority, priority, priority, 255)
    for pixel in innerPixels:
        maskDraw.point(pixel, pixelTuple)

    return mask

def generateTransparencyMask(image):
    return image.getchannel("A").point(lambda a: 0 if a == 0 else 255)


def getEnduGroup(enduGroups, enduTag):
    if not enduTag in enduGroups:
        enduImage = createCanvas()
        enduExtents = dict()
        enduGroups[enduTag] = (enduImage, enduExtents)
    return enduGroups[enduTag]

def generateEnduImage(enduImage, enduExtents):
    if (enduExtents["x2"] > canvasSize[0] or
        enduExtents["y2"] > canvasSize[1] or
        enduExtents["x1"] < 0 or
        enduExtents["y1"] < 0):
        raise ValueError("endu extents appear to be bigger than canvas??")
    
    return enduImage.crop((enduExtents["x1"], enduExtents["y1"], enduExtents["x2"], enduExtents["y2"]))

def updateExtents(templateEntry, image, enduExtents):
    if not "x1" in enduExtents:
        enduExtents["x1"] = templateEntry["x"]
        enduExtents["y1"] = templateEntry["y"]
        
        enduExtents["x2"] = templateEntry["x"] + image.width
        enduExtents["y2"] = templateEntry["y"] + image.height
    else:
        enduExtents["x1"] = min(enduExtents["x1"], templateEntry["x"])
        enduExtents["y1"] = min(enduExtents["y1"], templateEntry["y"])
        
        enduExtents["x2"] = max(enduExtents["x2"], templateEntry["x"] + image.width)
        enduExtents["y2"] = max(enduExtents["y2"], templateEntry["y"] + image.height)

def writeEnduInfos(enduGroups, enduInfo, subfolder):
    outputObject = {
        "faction": enduInfo["name"],
        "contact": enduInfo["contact"],
        "templates": []
    }
    
    # groups are in reverse order due to how we render
    for (groupName, (enduImage, enduExtents)) in reversed(enduGroups.items()):
        escapedName = urllib.parse.quote_plus(groupName)
        imageName = "endu_" + escapedName
        
        with generateEnduImage(enduImage, enduExtents) as enduCrop:
            writeCanvas(enduCrop, subfolder, imageName)
        enduImage.close()
        
        groupInfo = {
            "name": enduInfo["name"] + " - " + groupName,
            "sources": [
                enduInfo["source_root"] + imageName + ".png"
            ],
            "x": enduExtents["x1"],
            "y": enduExtents["y1"]
        }
        
        outputObject["templates"].append(groupInfo)
    
    with open(os.path.join(subfolder, "endu_template.json"), "w", encoding="utf-8") as f:
        f.write(json.dumps(outputObject, indent=4))


def updateVersion(subfolder):
    filePath = os.path.join(subfolder, "version.txt")
    templateVersion = 0
    
    if os.path.isfile(filePath):
        with open(filePath, "r", encoding="utf-8") as versionFile:
            templateVersion = int(versionFile.read())
    
    templateVersion += 1
    
    with open(filePath, "w", encoding="utf-8") as versionFile:
        versionFile.write(str(templateVersion))


def main(subfolder):
    # these are in layer order, so higher entries overwrite/take precedence over lower entries
    templateFile = loadTemplate(subfolder)
    
    # these will be in draw order, so later entries will overwrite earlier entries
    templates = []
    for templateFileEntry in reversed(templateFile["templates"]):
        # endu templates can have multiple entries in them, and they are listed in draw order
        templates.extend(resolveTemplateFileEntry(templateFileEntry))
    
    canvasImage = createCanvas()
    autoPickImage = createCanvas()
    maskImage = createCanvas(isMask=True)
    
    enduGroups = dict()
    
    utcNow = int(datetime.datetime.utcnow().timestamp())
    for templateEntry in templates:
        if ("enabled_utc" in templateEntry and int(templateEntry["enabled_utc"]) > utcNow):
            print("skip {0} due to future animation frame ({1:.02f}h)".format(templateEntry["name"], (int(templateEntry["enabled_utc"])-utcNow)/3600.0))
            continue
        
        print("render {0}".format(templateEntry["name"]))
        with (
        loadTemplateEntryImage(templateEntry, subfolder) as image,
        generateTransparencyMask(image) as transparencyMaskImage):
            copyTemplateEntryIntoCanvas(templateEntry, image, canvasImage)
            
            if ("autopick" in templateEntry and bool(templateEntry["autopick"])):
                copyTemplateEntryIntoCanvas(templateEntry, image, autoPickImage)
                with generatePriorityMask(templateEntry, image) as priorityMask:
                    copyTemplateEntryIntoCanvas(templateEntry, priorityMask, maskImage)
            else:
                eraseFromCanvas(templateEntry, transparencyMaskImage, autoPickImage)
                eraseFromCanvas(templateEntry, transparencyMaskImage, maskImage, isMask=True)
            
            if ("export_group" in templateEntry and str(templateEntry["export_group"]) != ""):
                (enduImage, enduExtents) = getEnduGroup(enduGroups, str(templateEntry["export_group"]))
                copyTemplateEntryIntoCanvas(templateEntry, image, enduImage)
                updateExtents(templateEntry, image, enduExtents)
            else:
                for (groupName, (enduImage, enduExtents)) in enduGroups.items():
                    eraseFromCanvas(templateEntry, transparencyMaskImage, enduImage)
    
    writeCanvas(canvasImage, subfolder, "canvas")
    writeCanvas(autoPickImage, subfolder, "autopick")
    writeCanvas(maskImage, subfolder, "mask")
    
    writeEnduInfos(enduGroups, templateFile["endu_info"], subfolder)
    
    canvasImage.close()
    autoPickImage.close()
    maskImage.close()
    
    updateVersion(subfolder)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Must provide a folder containing template.json as first arg")
        sys.exit(1)
    if not os.path.isfile(".build/template_assembler/assemble_template.py"):
        print("Must be invoked from repo root")
        sys.exit(1)
    main(sys.argv[1])