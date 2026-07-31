/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const elemEllipse: SvgaCaseJson = {
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
            "fill": "#e69933",
            "rx": 14,
            "ry": 34,
            "stroke": "none",
            "transform": "translate(150,100)",
            "animate": {
                "rx": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": 14
                        },
                        {
                            "time": 1000,
                            "value": 34
                        }
                    ]
                },
                "ry": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": 34
                        },
                        {
                            "time": 1000,
                            "value": 14
                        }
                    ]
                }
            }
        },
        {
            "type": "ellipse",
            "fill": "#33b3e6",
            "rx": 30,
            "ry": 30,
            "stroke": "none",
            "transform": "translate(50,100)"
        }
    ]
};
