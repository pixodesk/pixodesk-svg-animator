/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const elemMarker: SvgaCaseJson = {
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
                    "type": "marker",
                    "id": "_px_38bqgqpm",
                    "markerHeight": 16,
                    "markerUnits": "userSpaceOnUse",
                    "markerWidth": 16,
                    "orient": "auto",
                    "refX": 8,
                    "refY": 8,
                    "viewBox": "0 0 16 16",
                    "meta": {
                        "label": "arrowhead"
                    },
                    "children": [
                        {
                            "type": "path",
                            "d": "M0,0L16,8L0,16L0,0z",
                            "fill": "#e63333",
                            "stroke": "none"
                        }
                    ]
                }
            ]
        },
        {
            "type": "path",
            "d": "M132,58L168,100L132,142",
            "fill": "none",
            "markerEnd": "url(#_px_38bqgqpm)",
            "markerMid": "url(#_px_38bqgqpm)",
            "markerStart": "url(#_px_38bqgqpm)",
            "stroke": "#33994d",
            "strokeWidth": 3
        },
        {
            "type": "path",
            "d": "M50,55L50,150",
            "fill": "none",
            "markerEnd": "url(#_px_38bqgqpm)",
            "stroke": "#1a4dcc",
            "strokeWidth": 3
        }
    ]
};
