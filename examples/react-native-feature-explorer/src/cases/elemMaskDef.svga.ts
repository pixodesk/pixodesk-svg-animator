/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const elemMaskDef: SvgaCaseJson = {
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
                    "type": "mask",
                    "id": "_px_38det75m",
                    "children": [
                        {
                            "type": "rect",
                            "fill": "#1a4de6",
                            "height": 56,
                            "stroke": "none",
                            "transform": "translate(122,72)",
                            "width": 56,
                            "animate": {
                                "fill": {
                                    "keyframes": [
                                        {
                                            "time": 0,
                                            "value": "#1a4de6"
                                        },
                                        {
                                            "time": 1000,
                                            "value": "#e6331a"
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                }
            ]
        },
        {
            "type": "rect",
            "fill": "#1a4de6",
            "height": 56,
            "mask": "url(#_px_38det75m)",
            "stroke": "none",
            "transform": "translate(22,72)",
            "width": 56
        }
    ]
};
