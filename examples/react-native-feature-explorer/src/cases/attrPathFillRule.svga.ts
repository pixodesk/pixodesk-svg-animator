/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrPathFillRule: SvgaCaseJson = {
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
            "d": "M28,-16.6L0.5147,68L72.4442,15.7585L-16.4442,15.7585L55.4853,68L28,-16.6z",
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
            "d": "M28,-16.6L0.5147,68L72.4442,15.7585L-16.4442,15.7585L55.4853,68L28,-16.6z",
            "fill": "#3380e6",
            "fillRule": "evenodd",
            "stroke": "none",
            "transform": "translate(22,72)",
            "animate": {
                "fill": {
                    "keyframes": [
                        {
                            "time": 0,
                            "value": "#3380e6"
                        },
                        {
                            "time": 1000,
                            "value": "#e63333"
                        }
                    ]
                }
            }
        }
    ]
};
