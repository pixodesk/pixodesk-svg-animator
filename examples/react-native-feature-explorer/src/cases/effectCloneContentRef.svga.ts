/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const effectCloneContentRef: SvgaCaseJson = {
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
            "type": "use",
            "href": "#_px_38brsug8",
            "transform": "translate(150,100)",
            "effects": {
                "clone": {
                    "baseId": "_px_38bqgqon",
                    "type": "content"
                }
            },
            "meta": {
                "label": "use-content"
            }
        },
        {
            "type": "ellipse",
            "id": "_px_38bqgqon",
            "fill": "#4d80e6",
            "rx": 22,
            "ry": 16,
            "stroke": "none",
            "transform": "translate(50,100)",
            "meta": {
                "label": "source"
            }
        }
    ]
};
