/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const effectCloneSymbolAlongPathAaa: SvgaCaseJson = {
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
            "type": "g",
            "transform": "translate(100,100)translate(-152.1209,-48.1004)",
            "children": [
                {
                    "type": "ellipse",
                    "fill": "#007fff",
                    "rx": 9.641,
                    "ry": 9.641,
                    "stroke": "none",
                    "transform": "matrix(0.1027,-0.9947,0.9947,0.1027,124.7115,74.3754)",
                    "animate": {
                        "transform": {
                            "autoOrient": true,
                            "keyframes": [
                                {
                                    "time": 250,
                                    "value": {
                                        "translate": [
                                            124.7115,
                                            74.3754
                                        ]
                                    }
                                },
                                {
                                    "time": 500,
                                    "value": {
                                        "translate": [
                                            154.5315,
                                            12.1887
                                        ]
                                    },
                                    "tangentOut": [
                                        23.4667,
                                        -0.6531
                                    ],
                                    "tangentIn": [
                                        -23.4668,
                                        0.6532
                                    ]
                                },
                                {
                                    "time": 750,
                                    "value": {
                                        "translate": [
                                            189.172,
                                            75.1807
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                },
                {
                    "type": "path",
                    "d": "M18.1338,74.3754C18.1338,74.3754,24.487,12.8419,47.9538,12.1887C71.4205,11.5356,82.5943,75.1807,82.5943,75.1807",
                    "fill": "none",
                    "stroke": "#000000",
                    "strokeDasharray": "5,5",
                    "transform": "translate(106.5777,0)"
                }
            ]
        }
    ]
};
