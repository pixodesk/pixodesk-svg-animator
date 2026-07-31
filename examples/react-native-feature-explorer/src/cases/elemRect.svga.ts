/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const elemRect: SvgaCaseJson = {
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
            "fill": "#b34db3",
            "height": 40,
            "stroke": "none",
            "transform": "translate(122,130)",
            "width": 56,
            "animate": {
                "rx": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": 0
                        },
                        {
                            "time": 1000,
                            "value": 18
                        }
                    ]
                },
                "ry": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": 0
                        },
                        {
                            "time": 1000,
                            "value": 18
                        }
                    ]
                }
            }
        },
        {
            "type": "rect",
            "fill": "#80cc4d",
            "height": 40,
            "stroke": "none",
            "transform": "translate(22,130)",
            "width": 22,
            "animate": {
                "width": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": 22
                        },
                        {
                            "time": 1000,
                            "value": 66
                        }
                    ]
                }
            }
        },
        {
            "type": "rect",
            "fill": "#e68033",
            "height": 40,
            "rx": 12,
            "ry": 12,
            "stroke": "none",
            "transform": "translate(122,30)",
            "width": 56
        },
        {
            "type": "rect",
            "fill": "#3380e6",
            "height": 40,
            "stroke": "none",
            "transform": "translate(22,30)",
            "width": 56
        }
    ]
};
