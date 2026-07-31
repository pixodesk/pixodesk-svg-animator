/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrAppearanceVectorEffect: SvgaCaseJson = {
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
            "stroke": "#000000",
            "strokeWidth": 16,
            "transform": "translate(55,55)translate(-25,-25)",
            "width": 50
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 50,
            "stroke": "#000000",
            "strokeWidth": 16,
            "transform": "translate(145,55)scale(1.5,1.5)translate(-25,-25)",
            "vectorEffect": "non-scaling-stroke",
            "width": 50
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 50,
            "stroke": "#000000",
            "strokeWidth": 16,
            "transform": "translate(145,55)scale(0.25,0.25)translate(-25,-25)",
            "vectorEffect": "non-scaling-stroke",
            "width": 50
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 50,
            "stroke": "#000000",
            "strokeWidth": 16,
            "transform": "translate(55,145)translate(-25,-25)",
            "vectorEffect": "non-scaling-stroke",
            "width": 50
        },
        {
            "type": "rect",
            "fill": "none",
            "height": 50,
            "stroke": "#000000",
            "strokeWidth": 16,
            "transform": "translate(145,145)scale(0.25,0.25)translate(-25,-25)",
            "vectorEffect": "non-scaling-stroke",
            "width": 50,
            "animate": {
                "transform": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": {
                                "scale": [
                                    0.25,
                                    0.25
                                ],
                                "translate": [
                                    120,
                                    120
                                ],
                                "origin": [
                                    25,
                                    25
                                ]
                            }
                        },
                        {
                            "time": 1000,
                            "value": {
                                "scale": [
                                    1.5,
                                    1.5
                                ],
                                "translate": [
                                    120,
                                    120
                                ],
                                "origin": [
                                    25,
                                    25
                                ]
                            }
                        }
                    ]
                }
            }
        }
    ]
};
