/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const animLoopCycle: SvgaCaseJson = {
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
            "type": "ellipse",
            "fill": "#ff6633",
            "rx": 32,
            "ry": 32,
            "stroke": "none",
            "transform": "translate(100,100)",
            "animate": {
                "opacity": {
                    "loop": true,
                    "keyframes": [
                        {
                            "time": 0,
                            "value": 1
                        },
                        {
                            "time": 100,
                            "value": 0
                        },
                        {
                            "time": 200,
                            "value": 1
                        }
                    ]
                }
            }
        }
    ]
};
