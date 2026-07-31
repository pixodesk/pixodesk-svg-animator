/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const elemPatternAnim: SvgaCaseJson = {
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
            "type": "defs",
            "children": [
                {
                    "type": "pattern",
                    "id": "_px_38bqgqpr",
                    "height": 12,
                    "patternUnits": "userSpaceOnUse",
                    "viewBox": "0 0 12 12",
                    "width": 12,
                    "animate": {
                        "transform": {
                            "keyframes": [
                                {
                                    "time": 0,
                                    "value": {
                                        "rotate": 0
                                    }
                                },
                                {
                                    "time": 1000,
                                    "value": {
                                        "rotate": 90
                                    }
                                }
                            ]
                        }
                    },
                    "meta": {
                        "label": "dots"
                    },
                    "children": [
                        {
                            "type": "ellipse",
                            "fill": "#3380e6",
                            "rx": 3,
                            "ry": 3,
                            "stroke": "none",
                            "transform": "translate(6,6)"
                        }
                    ]
                }
            ]
        },
        {
            "type": "rect",
            "fill": "url(#_px_38bqgqpr)",
            "height": 110,
            "stroke": "none",
            "transform": "translate(100,100)",
            "width": 120
        }
    ]
};
