/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const effectMaskedByByPreset: SvgaCaseJson = {
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
            "fill": "#3380e6",
            "height": 90,
            "stroke": "none",
            "transform": "translate(100,100)",
            "width": 110,
            "effects": {
                "maskedBy": {
                    "href": "_px_38ddhlcv",
                    "maskType": "alpha"
                }
            },
            "meta": {
                "label": "masked-target"
            }
        },
        {
            "type": "path",
            "id": "_px_38ddhlcv",
            "d": "M0,-28L7.0534,-9.7082L26.6296,-8.6525L11.4127,3.7082L16.458,22.6525L0,12L-16.458,22.6525L-11.4127,3.7082L-26.6296,-8.6525L-7.0534,-9.7082L0,-28z",
            "fill": "#ffd91a",
            "stroke": "none",
            "transform": "translate(100,100)",
            "meta": {
                "appliedEffects": {
                    "shape": {
                        "value": {
                            "preset": {
                                "type": "star",
                                "points": 5,
                                "innerRadius": 12,
                                "radius": 28
                            }
                        }
                    }
                }
            }
        }
    ]
};
