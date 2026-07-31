/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrTransformSkew: SvgaCaseJson = {
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
            "height": 30,
            "stroke": "none",
            "transform": "translate(30,85)",
            "width": 40,
            "animate": {
                "transform": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "skew": 0,
                                "translate": [
                                    30,
                                    85
                                ]
                            }
                        },
                        {
                            "time": 1000,
                            "value": {
                                "skew": 30,
                                "translate": [
                                    30,
                                    85
                                ]
                            }
                        }
                    ]
                }
            }
        },
        {
            "type": "rect",
            "fill": "#33b366",
            "height": 30,
            "stroke": "none",
            "transform": "translate(130,85)skewX(15)",
            "width": 40
        }
    ]
};
