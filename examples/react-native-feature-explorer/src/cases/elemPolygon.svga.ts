/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const elemPolygon: SvgaCaseJson = {
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
            "type": "path",
            "d": "M28,4L50,18L42,46L14,46L6,18L28,4z",
            "fill": "#3380e6",
            "stroke": "none",
            "transform": "translate(122,72)",
            "animate": {
                "fill": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": "#3380e6"
                        },
                        {
                            "time": 1000,
                            "value": "#e6331a"
                        }
                    ]
                }
            }
        },
        {
            "type": "path",
            "d": "M28,4L50,18L42,46L14,46L6,18L28,4z",
            "fill": "#3380e6",
            "stroke": "none",
            "transform": "translate(22,72)"
        }
    ]
};
