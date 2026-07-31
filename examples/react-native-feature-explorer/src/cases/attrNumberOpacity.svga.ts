/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrNumberOpacity: SvgaCaseJson = {
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
            "fill": "#e66633",
            "height": 50,
            "stroke": "none",
            "transform": "translate(125,75)",
            "width": 50,
            "animate": {
                "opacity": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": 1
                        },
                        {
                            "time": 1000,
                            "value": 0.2
                        }
                    ]
                }
            }
        },
        {
            "type": "rect",
            "fill": "#3380e6",
            "height": 50,
            "opacity": 0.4,
            "stroke": "none",
            "transform": "translate(25,75)",
            "width": 50
        }
    ]
};
