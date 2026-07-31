/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrVectorDasharray: SvgaCaseJson = {
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
            "height": 40,
            "stroke": "#cc334d",
            "strokeDasharray": "16,16",
            "strokeWidth": 3,
            "transform": "translate(122,80)",
            "width": 56,
            "animate": {
                "strokeDasharray": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": [
                                16,
                                16
                            ]
                        },
                        {
                            "time": 1000,
                            "value": [
                                2,
                                2
                            ]
                        }
                    ]
                }
            }
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 40,
            "stroke": "#1a66cc",
            "strokeDasharray": "6,3",
            "strokeWidth": 3,
            "transform": "translate(22,80)",
            "width": 56
        }
    ]
};
