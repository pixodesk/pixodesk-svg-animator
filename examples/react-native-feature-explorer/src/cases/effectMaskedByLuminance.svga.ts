/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const effectMaskedByLuminance: SvgaCaseJson = {
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
            "type": "rect",
            "fill": "#33b366",
            "height": 90,
            "stroke": "none",
            "transform": "translate(100,100)",
            "width": 100,
            "effects": {
                "maskedBy": {
                    "href": "_px_38bqgqqc",
                    "maskType": "luminance"
                }
            },
            "meta": {
                "label": "lum-target"
            }
        },
        {
            "type": "ellipse",
            "id": "_px_38bqgqqc",
            "rx": 50,
            "ry": 50,
            "stroke": "none",
            "transform": "translate(100,100)",
            "effects": {
                "fillGradient": {
                    "type": "radial",
                    "c": [
                        0,
                        0
                    ],
                    "fp": [
                        0,
                        0
                    ],
                    "r": 50,
                    "stops": [
                        {
                            "offset": 0,
                            "color": "#ffffff"
                        },
                        {
                            "offset": 1,
                            "color": "#000000"
                        }
                    ],
                    "gradientUnits": "userSpaceOnUse",
                    "spreadMethod": "pad"
                }
            },
            "meta": {
                "label": "mask-luminance"
            }
        }
    ]
};
