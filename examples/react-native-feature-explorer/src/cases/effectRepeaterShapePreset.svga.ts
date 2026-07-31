/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const effectRepeaterShapePreset: SvgaCaseJson = {
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
            "d": "M3,0C3.5133,1.9351,1.9678,3.8816,0,4.25C-2.6464,4.7455,-5.1145,2.6646,-5.5,0C-5.9843,-3.3479,-3.3595,-6.354,0,-6.75C4.0451,-7.2268,7.5969,-4.0531,8,0C8.4715,4.7401,4.7459,8.8418,0,9.25C-5.4337,9.7174,-10.0879,5.4382,-10.5,0C-10.9643,-6.1266,-6.1301,-11.3349,0,-11.75C6.8189,-12.2118,12.5825,-6.8218,13,0C13.4597,7.5108,7.5132,13.8305,0,14.25C-8.2025,14.708,-15.0788,8.2044,-15.5,0",
            "fill": "none",
            "stroke": "#3366e6",
            "strokeWidth": 2,
            "transform": "translate(166.6667,100)",
            "meta": {
                "appliedEffects": {
                    "shape": {
                        "value": {
                            "preset": {
                                "type": "spiral",
                                "innerRadius": 3,
                                "radiusIncrement": 5,
                                "turnsCount": 2.5
                            }
                        }
                    }
                }
            }
        },
        {
            "type": "path",
            "d": "M0,-28L24.2487,-14L24.2487,14L0,28L-24.2487,14L-24.2487,-14L0,-28z",
            "fill": "#4db366",
            "stroke": "none",
            "transform": "translate(100,100)",
            "meta": {
                "appliedEffects": {
                    "shape": {
                        "value": {
                            "preset": {
                                "type": "polygon",
                                "points": 6,
                                "radius": 28
                            }
                        }
                    }
                }
            }
        },
        {
            "type": "path",
            "d": "M0,-28L7.0534,-9.7082L26.6296,-8.6525L11.4127,3.7082L16.458,22.6525L0,12L-16.458,22.6525L-11.4127,3.7082L-26.6296,-8.6525L-7.0534,-9.7082L0,-28z",
            "fill": "#ffd91a",
            "stroke": "none",
            "transform": "translate(33.3333,100)",
            "effects": {
                "repeater": {
                    "copies": 3,
                    "translate": [
                        32,
                        0
                    ],
                    "scale": [
                        80,
                        80
                    ]
                }
            },
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
