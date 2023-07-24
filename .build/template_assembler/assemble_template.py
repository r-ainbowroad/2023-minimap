from PIL import Image, ImageDraw
from colorspacious import deltaE
import os
import sys
import urllib.request
import urllib.parse
import json
import datetime
import math
import traceback

palettes = [
    set([ # 2022 expansion 2 / 2k x 2k palette
        (  0,   0,   0, 255), # 0
        (  0, 117, 111, 255), # 1
        (  0, 158, 170, 255), # 2
        (  0, 163, 104, 255), # 3
        (  0, 204, 120, 255), # 4
        (  0, 204, 192, 255), # 5
        (106,  92, 255, 255), # 6
        (109,   0,  26, 255), # 7
        (109,  72,  47, 255), # 8
        (126, 237,  86, 255), # 9
        (129,  30, 159, 255), # 10
        (137, 141, 144, 255), # 11
        (148, 179, 255, 255), # 12
        (156, 105,  38, 255), # 13
        (180,  74, 192, 255), # 14
        (190,   0,  57, 255), # 15
        (212, 215, 217, 255), # 16
        (222,  16, 127, 255), # 17
        (228, 171, 255, 255), # 18
        (255,  56, 129, 255), # 19
        (255,  69,   0, 255), # 20
        (255, 153, 170, 255), # 21
        (255, 168,   0, 255), # 22
        (255, 180, 112, 255), # 23
        (255, 214,  53, 255), # 24
        (255, 248, 184, 255), # 25
        (255, 255, 255, 255), # 26
        ( 36,  80, 164, 255), # 27
        ( 54, 144, 234, 255), # 28
        ( 73,  58, 193, 255), # 29
        ( 81,  82,  82, 255), # 30
        ( 81, 233, 244, 255), # 31
    ]),
    set([ # 2023 inital
        # 0
        # 1
        (255,  69,   0, 255),
        (255, 168,   0, 255),
        (255, 214,  53, 255),
        # 5
        (  0, 163, 104, 255),
        # 8
        # 9
        # 10
        # 11
        # 12
        ( 54, 144, 234, 255),
        # 14
        # 15
        # 16
        # 17
        # 18
        (180,  74, 192, 255),
        # 20
        # 21
        # 22
        # 23
        # 24
        # 25
        # 26
        (  0,   0,   0, 255),
        # 28
        # 29
        # 30
        (255, 255, 255, 255),
    ]),
    set([ # 2023 2nd
        # 0
        # 1
        (255,  69,   0, 255),
        (255, 168,   0, 255),
        (255, 214,  53, 255),
        # 5
        (  0, 163, 104, 255),
        # 7
        (126, 237,  86, 255), # 8
        # 9
        # 10
        # 11
        ( 36,  80, 164, 255), # 12
        ( 54, 144, 234, 255),
        ( 81, 233, 244, 255), # 14
        # 15
        # 16
        # 17
        (129,  30, 159, 255), # 18
        (180,  74, 192, 255),
        # 20
        # 21
        # 22
        (255, 153, 170, 255), # 23
        # 24
        (156, 105,  38, 255), # 25
        # 26
        (  0,   0,   0, 255),
        # 28
        (137, 141, 144, 255), # 29
        (212, 215, 217, 255), # 30
        (255, 255, 255, 255),
    ]),
    set([ # 2023 3rd
        # 0
        (190, 0, 57, 255), # 1
        (255, 69, 0, 255), # 2
        (255, 168, 0, 255), # 3
        (255, 214, 53, 255), # 4
        # 5
        (0, 163, 104, 255), # 6
        (0, 204, 120, 255), # 7
        (126, 237, 86, 255), # 8
        (0, 117, 111, 255), # 9
        (0, 158, 170, 255), # 10
        # 11
        (36, 80, 164, 255), # 12
        (54, 144, 234, 255), # 13
        (81, 233, 244, 255), # 14
        (73, 58, 193, 255), # 15
        (106, 92, 255, 255), # 16
        # 17
        (129, 30, 159, 255), # 18
        (180, 74, 192, 255), # 19
        # 20
        # 21
        (255, 56, 129, 255), # 22
        (255, 153, 170, 255), # 23
        (109, 72, 47, 255), # 24
        (156, 105, 38, 255), # 25
        # 26
        (0, 0, 0, 255), # 27
        # 28
        (137, 141, 144, 255), # 29
        (212, 215, 217, 255), # 30
        (255, 255, 255, 255), # 31
    ])
]

# starter canvas of 1k x 1x. 0, 0 on the client moved to 500, 500 in screen space
# we expect the canvas to be able to expand left or up which screws with the origin
leftExpansion = 1000
rightExpansion = 500
topExpansion = 500
bottomExpansion = 500

canvasSize = (1000 + leftExpansion + rightExpansion, 1000 + topExpansion + bottomExpansion)
topLeftOffset = (leftExpansion, topExpansion)
palette = palettes[3]

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
    if (templateEntry["x"] < 0 or
        templateEntry["y"] < 0):
        templateEntry["x"] += 500
        templateEntry["y"] += 500
        print("{0} seems to respect center?? {1}".format(templateEntry["name"], templateEntry))

    if (templateEntry["x"] + image.width > canvasSize[0] or
        templateEntry["y"] + image.height > canvasSize[1] or
        templateEntry["x"] < 0 or
        templateEntry["y"] < 0):
        print("{0} is not entirely on canvas?? {1}".format(templateEntry["name"], templateEntry))
    
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

def colorDistanceRawEuclidean(color, pixel):
    elementDeltaSquares = [(colorElement - pixelElement) ** 2 for colorElement, pixelElement in zip(color[0:3], pixel[0:3])]
    return math.sqrt(sum(elementDeltaSquares))

def colorDistancePerceptualEuclidean(color, pixel):
    weights = [0.3, 0.59, 0.11]
    elementDelta = [(colorElement - pixelElement) for colorElement, pixelElement in zip(color[0:3], pixel[0:3])]
    weightedDelta = [weightElement * deltaElement for weightElement, deltaElement in zip(weights, elementDelta)]
    weightedDeltaSquares = [deltaElement ** 2 for deltaElement in weightedDelta]
    return math.sqrt(sum(weightedDeltaSquares))

def normalizeImage(convertedImage):
    fixedPixels = 0
    alphaProblems = 0
    wrongPixels = set()
    colorCorrections = dict()
    
    for y in range(0, convertedImage.height):
        for x in range(0, convertedImage.width):
            xy = (x, y)
            pixel = convertedImage.getpixel(xy)
            
            if isTransparent(pixel):
                convertedImage.putpixel(xy, (0, 0, 0, 0))
                continue
            
            if pixel in palette:
                continue

            if pixel[0:3] in colorCorrections:
                v = colorCorrections[pixel[0:3]]
                newColor = (v[0], v[1], v[2], pixel[3])
                newDelta = v[3]
            else:
                newDelta = 99999999
                newColor = None
                for color in palette:
                    colorDelta = deltaE(color[0:3], pixel[0:3], input_space="sRGB255")
                    if colorDelta < newDelta:
                        newColor = color
                        newDelta = colorDelta
                colorCorrections[pixel[0:3]] = [*newColor[0:3], newDelta]
            
            if pixel[0:3] == newColor[0:3]:
                alphaProblems += 1
            else:
                fixedPixels += 1
                wrongPixels.add((pixel, newColor, newDelta))
            convertedImage.putpixel(xy, newColor)
    
    if fixedPixels != 0 or alphaProblems != 0:
        print("\tfixed {0} incorrect pixels and {1} semi-transparent pixels".format(fixedPixels, alphaProblems))
        maxOops = 0
        for (original, new, difference) in wrongPixels:
            maxOops = max(maxOops, difference)
            print("\t\t{0} -> {1} (delta = {2})".format(original, new, difference))
        
        if (maxOops > 20):
            print("\ttoo broken with max = {0}, excluding from autopick".format(maxOops))
            return False
    return True

def loadTemplateEntryImage(templateEntry, subfolder):
    # used to erase animations from all shipped images. render a fully opaque mask
    try:
        if "forcewidth" in templateEntry and templateEntry["forcewidth"] != None:
            return createImage((templateEntry["forcewidth"], templateEntry["forceheight"]), isMask = True)
    except Exception as e:
        print("Eat exception {0}".format(traceback.format_exc()))

    for imageSource in templateEntry["images"]:
        try:
            if imageSource.startswith("http"):
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/113.0",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                }
                request = urllib.request.Request(imageSource, headers = headers, method = "GET")
                responseObject = urllib.request.urlopen(request, timeout=5)
                rawImage = Image.open(responseObject)
            else:
                rawImage = Image.open(os.path.join(subfolder, imageSource))
            
            convertedImage = Image.new("RGBA", (rawImage.width, rawImage.height))
            convertedImage.paste(rawImage)

            rawImage.close()
            
            isClean = normalizeImage(convertedImage)
            if not isClean:
                templateEntry["__noauto"] = True
            
            return convertedImage
        except Exception as e:
            print("Eat exception {0}".format(traceback.format_exc()))
    
    raise RuntimeError("unable to load any images for {0}".format(templateEntry["name"]))

def resolveTemplateFileEntry(templateFileEntry):
    requiredProperties = ["name", "x", "y"]
    if "endu" in templateFileEntry:
        try:
            target = templateFileEntry["endu"]
            
            if "rentry.co" in target:
                print("Rejecting rentry.co template from {0}".format(templateFileEntry["name"]))
                return []
            
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/113.0",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            }
            request = urllib.request.Request(target, headers = headers, method = "GET")
            responseObject = urllib.request.urlopen(request, timeout=5)
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
                
                converted = {
                    "name": localName,
                    "images": enduTemplateEntry["sources"],
                    "x": enduTemplateEntry["x"],
                    "y": enduTemplateEntry["y"],
                }
                
                for copyProperty in ["export_group", "autopick", "priority"]:
                    if copyProperty in templateFileEntry:
                        converted[copyProperty] = templateFileEntry[copyProperty]
                
                if converted["x"] < 0 or converted["y"] < 0:
                    print("Forcing Endu template {0} with negative coordinates to positive".format(localName))
                    converted["x"] = abs(converted["x"])
                    converted["y"] = abs(converted["y"])
                
                if "frameRate" in enduTemplateEntry and enduTemplateEntry["frameRate"] != None:
                    print("Forcing exclusion of animated template {0}".format(localName))
                    converted["autopick"] = False
                    converted["__exclude"] = True
                    converted["forcewidth"] = enduTemplateEntry["frameWidth"]
                    converted["forceheight"] = enduTemplateEntry["frameHeight"]
                
                output.append(converted)
            return output
        except Exception as e:
            print("Failed to load Endu template for {0}: {1}\n{2}".format(templateFileEntry["name"], templateFileEntry["endu"], traceback.format_exc()))
            return []
    elif "images" in templateFileEntry:
        for requiredProperty in requiredProperties:
            if not requiredProperty in templateFileEntry:
                # going to make a bad assumption that name is provided...
                print("Missing required property {1} from {0}".format(templateFileEntry["name"], requiredProperty))
                raise KeyError(1)
        
        if "use_reddit_coords" in templateFileEntry and templateFileEntry["use_reddit_coords"]:
            templateFileEntry["x"] += topLeftOffset[0] + 500
            templateFileEntry["y"] += topLeftOffset[1] + 500
        else:
            # our default templates are rooted at the original 1k x 1k 0,0
            templateFileEntry["x"] += topLeftOffset[0]
            templateFileEntry["y"] += topLeftOffset[1]
        
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
            "y": enduExtents["y1"],
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


def loadAllianceTemplatesFromCsv(csvLink, selfSourceRoot, honorAlliance):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/113.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    }
    request = urllib.request.Request(csvLink, headers = headers, method = "GET")
    responseObject = urllib.request.urlopen(request, timeout=5)
    csvText = responseObject.read().decode("utf-8")
    
    outputTemplates = []
    for line in csvText.split("\n"):
        chunks = line.strip().split(",")
        if len(chunks) < 4:
            print("malformed row")
            continue

        chunks = [v.strip('"') for v in chunks]
        (name, enduLink, blacklisted, allianceMember) = chunks[0:4]
        if blacklisted != "":
            print("skipping blacklisted template {0}".format(name))
            continue
        
        if allianceMember.lower() != "true" and honorAlliance:
            print("skipping non-alliance template {0}".format(name))
            continue
        
        if selfSourceRoot in enduLink:
            print("skipping self {0}".format(name))
            continue
        
        print("import template {0}".format(name))
        outputTemplate = {
            "name": name,
            "endu": enduLink,
            "priority": 1,
            "autopick": True
        }
        
        outputTemplates.append(outputTemplate)
    return outputTemplates

def getTemplates(templateFile):
    selfSourceRoot = templateFile["endu_info"]["source_root"]
    
    # these are in layer order, so higher entries overwrite/take precedence over lower entries
    inputTemplates = templateFile["templates"]
    if "alliance_csv_import" in templateFile:
        inputTemplates.extend(loadAllianceTemplatesFromCsv(templateFile["alliance_csv_import"], selfSourceRoot, honorAlliance=True))
    
    if "world_csv_import" in templateFile:
        inputTemplates.extend(loadAllianceTemplatesFromCsv(templateFile["world_csv_import"], selfSourceRoot, honorAlliance=False))
    
    # these will be in draw order, so later entries will overwrite earlier entries
    templates = []
    for templateFileEntry in reversed(inputTemplates):
        # endu templates can have multiple entries in them, and they are listed in draw order
        templates.extend(resolveTemplateFileEntry(templateFileEntry))
    return templates

def main(subfolder):
    templateFile = loadTemplate(subfolder)
    templates = getTemplates(templateFile)
    
    canvasImage = createCanvas()
    autoPickImage = createCanvas()
    maskImage = createCanvas(isMask=True)
    
    enduGroups = dict()
    
    utcNow = int(datetime.datetime.utcnow().timestamp())
    print(f"now is {utcNow}")
    for templateEntry in templates:
        if ("enabled_utc" in templateEntry and int(templateEntry["enabled_utc"]) > utcNow):
            print("skip {0} due to future animation frame ({1:.02f}h)".format(templateEntry["name"], (int(templateEntry["enabled_utc"])-utcNow)/3600.0))
            continue
        
        print("render {0}".format(templateEntry["name"]))
        try:
            with (
            loadTemplateEntryImage(templateEntry, subfolder) as image,
            generateTransparencyMask(image) as transparencyMaskImage):
                if ("__exclude" in templateEntry):
                    eraseFromCanvas(templateEntry, transparencyMaskImage, canvasImage)
                else:
                    copyTemplateEntryIntoCanvas(templateEntry, image, canvasImage)
                
                if ("autopick" in templateEntry and bool(templateEntry["autopick"]) and not "__noauto" in templateEntry):
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
        except:
            print(f"Failed to load {templateEntry['name']}")
    
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