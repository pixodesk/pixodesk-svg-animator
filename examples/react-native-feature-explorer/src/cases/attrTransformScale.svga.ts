/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrTransformScale: SvgaCaseJson = {
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
            "fill": "#1a80cc",
            "height": 34,
            "stroke": "none",
            "transform": "translate(150,100)",
            "width": 34,
            "animate": {
                "transform": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "scale": [
                                    1,
                                    1
                                ],
                                "translate": [
                                    150,
                                    100
                                ]
                            }
                        },
                        {
                            "time": 1000,
                            "value": {
                                "scale": [
                                    -1,
                                    1
                                ],
                                "translate": [
                                    150,
                                    100
                                ]
                            }
                        }
                    ]
                }
            }
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 34,
            "opacity": 0.5,
            "stroke": "#9999a8",
            "transform": "translate(150,100)scale(-1,1)",
            "width": 34
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 34,
            "opacity": 0.5,
            "stroke": "#9999a8",
            "transform": "translate(150,100)scale(-0.5,1)",
            "width": 34
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 34,
            "opacity": 0.5,
            "stroke": "#9999a8",
            "transform": "translate(150,100)scale(0,1)",
            "width": 34
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 34,
            "opacity": 0.5,
            "stroke": "#9999a8",
            "transform": "translate(150,100)scale(0.5,1)",
            "width": 34
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 34,
            "opacity": 0.5,
            "stroke": "#9999a8",
            "transform": "translate(150,100)",
            "width": 34
        },
        {
            "type": "rect",
            "fill": "#e6991a",
            "height": 34,
            "stroke": "none",
            "transform": "translate(50,100)scale(1.2,0.9)",
            "width": 34
        }
    ]
};
