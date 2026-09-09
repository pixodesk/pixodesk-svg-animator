/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const animLoopLoopIn: SvgaCaseJson = {
    "type": "svg",
    "fill": "none",
    "viewBox": "0 0 200 200",
    "animator": {
        "timeline": {
            "mode": "auto",
            "duration": 1000,
            "trigger": {
                "startOn": "load",
                "outAction": "pause"
            },
            "direction": "normal"
        }
    },
    "children": [
        {
            "type": "rect",
            "fill": "#3380e6",
            "height": 30,
            "stroke": "none",
            "transform": "translate(100,100)",
            "width": 30,
            "animate": {
                "transform": {
                    "loop": {
                        "repeatAt": "start"
                    },
                    "keyframes": [
                        {
                            "time": 600,
                            "value": {
                                "translate": [
                                    40,
                                    100
                                ]
                            }
                        },
                        {
                            "time": 1000,
                            "value": {
                                "translate": [
                                    160,
                                    100
                                ]
                            }
                        }
                    ]
                }
            }
        }
    ]
};
