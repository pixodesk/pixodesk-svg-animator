/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const effectClipPath: SvgaCaseJson = {
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
            "type": "ellipse",
            "fill": "#007fff",
            "rx": 28.9258,
            "ry": 28.9258,
            "stroke": "none",
            "transform": "translate(38.9305,72.8326)",
            "effects": {
                "clipPath": {
                    "d": "M43.4051,-2.1987L43.4051,36.4967L-1.3509,36.4967L-1.3509,-2.1987L43.4051,-2.1987z"
                }
            }
        },
        {
            "type": "path",
            "d": "M0,-28.9258C15.9753,-28.9258,28.9258,-15.9753,28.9258,0C28.9258,15.9753,15.9753,28.9258,0,28.9258C-15.9753,28.9258,-28.9258,15.9753,-28.9258,0C-28.9258,-15.9753,-15.9753,-28.9258,0,-28.9258z",
            "fill": "#007fff",
            "stroke": "none",
            "transform": "translate(138.9258,72.8326)",
            "effects": {
                "clipPath": {
                    "d": "M43.4051,-2.1987L43.4051,36.4966L-1.3509,36.4966L-1.3509,-2.1987L43.4051,-2.1987z",
                    "animate": {
                        "keyframes": [
                            {
                                "time": 0,
                                "value": {
                                    "path": "M43.4051,-2.1987L43.4051,36.4966L-1.3509,36.4966L-1.3509,-2.1987L43.4051,-2.1987z"
                                }
                            },
                            {
                                "time": 1000,
                                "value": {
                                    "path": "M43.4051,-2.1987L43.4051,36.4966L-1.3509,36.4966L-48.9258,-42.8326L43.4051,-2.1987z"
                                }
                            }
                        ]
                    }
                }
            }
        }
    ]
};
