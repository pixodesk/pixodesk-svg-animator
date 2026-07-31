/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const animLoopSegmentCount: SvgaCaseJson = {
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
            "fill": "#3399e6",
            "rx": 28,
            "ry": 28,
            "stroke": "none",
            "transform": "translate(150,100)",
            "animate": {
                "opacity": {
                    "loop": {
                        "segmentCount": 2
                    },
                    "keyframes": [
                        {
                            "time": 0,
                            "value": 1
                        },
                        {
                            "time": 200,
                            "value": 0
                        },
                        {
                            "time": 400,
                            "value": 1
                        },
                        {
                            "time": 600,
                            "value": 0
                        }
                    ]
                }
            }
        },
        {
            "type": "ellipse",
            "fill": "#e66633",
            "rx": 28,
            "ry": 28,
            "stroke": "none",
            "transform": "translate(50,100)",
            "animate": {
                "opacity": {
                    "loop": {
                        "segmentCount": 1
                    },
                    "keyframes": [
                        {
                            "time": 0,
                            "value": 1
                        },
                        {
                            "time": 200,
                            "value": 0
                        },
                        {
                            "time": 400,
                            "value": 1
                        },
                        {
                            "time": 600,
                            "value": 0
                        }
                    ]
                }
            }
        }
    ]
};
