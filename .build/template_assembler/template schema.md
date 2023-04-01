#### schema Template

* `enduInfo`

    `EnduInfo`

* `templates`

    array of `TemplateEntry`
    * Items in the art array are layered in the order they appear. Higher layers will overwrite art from lower layers.

#### schema EnduInfo
Information that will be put in the generated Endu-style template

* `contact`

    string
    * some kind of way to get in contact with whoever owns this template e.g. discord links, emails, whatever

* `source`

    string
    * the URI that the produced endu.png image will be available at

* `name`

    string
    * the name that this image will have in the Endu-style template which should uniquely identify the owning faction

#### abstract schema TemplateEntry
The presence of an `endu` property means this is a `TemplateEntryEndu`, otherwise it's a `TemplateEntryLocal`

* `name`

    string
    * a description for humans and/or ponies

* `bots`

    boolean (or something that parses to a bool)
    * optional, defaults to false
    * if true, causes the image to be put on the bot canvas along with generating a priority mask to put on the mask canvas
    * enabling this for an Endu template means **all the things in it** are bot-enabled
  
* `priority`

    integer (between 1 and 10, inclusive)
    * relative priority of this image for the bots
    * optional, defaults to 1
    * "edge" pixels receive additional priority automatically
        * edge pixels are non-transparent pixels which are either on the boundary of the image or have a transparent pixel in the surrounding 8 pixels

* `pony`

    boolean (or something that parses to a bool)
    * optional, defaults to false
    * if true, marks this image as part of our faction's things for export in an Endu template for integration with other factions
    * enabling this for an Endu template means **all the things in it** are considered pony

* `enabled_after`

    integer
    * optional, defaults to beginning of time
    * if provided, determines when the unix timestamp when the template will be available for application

#### schema TemplateEntryEndu inherits `TemplateEntry`

* `endu`

    string
    * a uri for an Endu-style template
    * recursive lookups are not supported, meaning whitelist and blacklist are ignored
    * animations are not supported and are ignored

#### schema TemplateEntryLocal inherits `TemplateEntry`

* `images`

  array of string
  * sources for an image
      * all sources should be the same image
      * sources are tried in order until one works
  * elements may be either of
      * a local path relative to the folder the template.json lives in
      * a uri that starts with "http"

* `x`

  integer
  * the X coordinate in screen space of the top left corner of the image

* `y`

  integer
  * the y coordinate in screen space of the top left corner of the image
