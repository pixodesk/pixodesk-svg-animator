/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrColorStroke: SvgaCaseJson = {
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
            "fill": "none",
            "height": 50,
            "stroke": "#1a4de6",
            "strokeWidth": 16,
            "transform": "translate(125,75)",
            "width": 50,
            "animate": {
                "stroke": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": "#1a4de6"
                        },
                        {
                            "time": 1000,
                            "value": "#e6331a"
                        }
                    ]
                }
            }
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 50,
            "stroke": "#1a4de6",
            "strokeWidth": 16,
            "transform": "translate(25,75)",
            "width": 50
        }
    ]
};
