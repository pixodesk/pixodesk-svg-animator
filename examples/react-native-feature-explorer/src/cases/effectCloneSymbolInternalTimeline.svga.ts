/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const effectCloneSymbolInternalTimeline: SvgaCaseJson = {
    "type": "svg",
    "fill": "none",
    "viewBox": "0 0 200 200",
    "animator": {
        "duration": 1000,
        "mode": "auto",
        "direction": "normal",
        "timeline": "time",
        "trigger": {
            "startOn": "load",
            "outAction": "pause"
        }
    },
    "children": [
        {
            "type": "defs",
            "children": [
                {
                    "type": "symbol",
                    "id": "_px_38bqgqol",
                    "viewBox": "0 0 40 40",
                    "meta": {
                        "label": "star-symbol",
                        "timeline": {
                            "duration": 500
                        }
                    },
                    "children": [
                        {
                            "type": "path",
                            "d": "M0,-16L4.1145,-5.6631L15.2169,-4.9443L6.6574,2.1631L9.4046,12.9443L0,7L-9.4046,12.9443L-6.6574,2.1631L-15.2169,-4.9443L-4.1145,-5.6631L0,-16z",
                            "fill": "#ffb333",
                            "stroke": "none",
                            "transform": "translate(20,20)",
                            "meta": {
                                "appliedEffects": {
                                    "shape": {
                                        "value": {
                                            "preset": {
                                                "type": "star",
                                                "points": 5,
                                                "innerRadius": 7,
                                                "radius": 16
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    ]
                }
            ]
        },
        {
            "type": "use",
            "height": 40,
            "href": "#_px_38bqgqol",
            "transform": "translate(130,80)rotate(45)",
            "width": 40,
            "meta": {
                "label": "use-with-transform"
            }
        },
        {
            "type": "use",
            "height": 40,
            "href": "#_px_38bqgqol",
            "transform": "translate(30,80)",
            "width": 40,
            "meta": {
                "label": "use-no-transform"
            }
        }
    ]
};
