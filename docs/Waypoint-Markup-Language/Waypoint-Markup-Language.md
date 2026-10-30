## What is WPML?
Waypoint markup language is the flight format standard used by DJI, some other drone companies and third-party mission planning software. It is XML based and an extension of keyhole markup language.

example.KMZ/
- res/
- .kml
- .wpml

## KML and WPML Files
- [.kml](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dji-wpml/template-kml.html)
  - Creation information: It mainly contains the information of the route file itself, such as the creation and update time of the file.
  - Mission information: mainly includes the wpml:missionConfig element, which defines the global parameters of the route mission, etc.
  - Template information: It mainly contains the Folder element, which defines the template information of the route (such as waypoint flight, mapping, oblique photography, and linear flight, etc.). Different route template types contain different elements.
- [.wpml](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dji-wpml/waylines-wpml.html)
  - Mission information: Contains mainly the wpml:missionConfig element, which defines the global parameters of the waylines mission, etc.
  - Waylines information: Contains mainly Folder elements, which define detailed waylines information (path definition, action definition, etc.). Each Folder represents an executable route. In particular, when using the "mapping3d" template, 5 executable routes are generated, corresponding to the 5 Folder elements in waylines.wpml.

## Fields (important fields to be inserted)
#### [.kml Fiels](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dji-wpml/template-kml.html)

#### [.wpml Fields](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dji-wpml/waylines-wpml.html)

#### [Common Fields](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dji-wpml/common-element.html)
