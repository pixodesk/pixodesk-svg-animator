/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const effectRetimeStretch: SvgaCaseJson = {
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
            "href": "#_px_38tcck55",
            "transform": "translate(0,110)",
            "effects": {
                "clone": {
                    "baseId": "_px_38bqgqqn",
                    "type": "content",
                    "retime": {
                        "stretch": 2
                    }
                }
            },
            "meta": {
                "label": "use1"
            }
        },
        {
            "type": "g",
            "id": "_px_38bqgqqp",
            "transform": "translate(-2,-12)",
            "meta": {
                "label": "g2"
            },
            "children": [
                {
                    "type": "ellipse",
                    "fill": "#ff0000",
                    "rx": 8,
                    "ry": 8,
                    "stroke": "none",
                    "transform": "translate(30,40)",
                    "animate": {
                        "transform": {
                            "keyframes": [
                                {
                                    "time": 0,
                                    "value": {
                                        "translate": [
                                            30,
                                            40
                                        ]
                                    }
                                },
                                {
                                    "time": 1000,
                                    "value": {
                                        "translate": [
                                            170,
                                            40
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    "meta": {
                        "label": "g2-content"
                    }
                }
            ]
        },
        {
            "type": "g",
            "id": "_px_38bqgqqn",
            "transform": "translate(0,42)",
            "meta": {
                "label": "g1"
            },
            "children": [
                {
                    "type": "use",
                    "href": "#_px_38tcck54",
                    "transform": "translate(0,25)",
                    "effects": {
                        "clone": {
                            "baseId": "_px_38bqgqqp",
                            "type": "content",
                            "retime": {
                                "stretch": 2
                            }
                        }
                    },
                    "meta": {
                        "label": "use2"
                    }
                },
                {
                    "type": "ellipse",
                    "fill": "#3399e6",
                    "rx": 8,
                    "ry": 8,
                    "stroke": "none",
                    "transform": "translate(30,40)",
                    "animate": {
                        "transform": {
                            "keyframes": [
                                {
                                    "time": 0,
                                    "value": {
                                        "translate": [
                                            30,
                                            40
                                        ]
                                    }
                                },
                                {
                                    "time": 1000,
                                    "value": {
                                        "translate": [
                                            170,
                                            40
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    "meta": {
                        "label": "g1-content"
                    }
                }
            ]
        },
        {
            "type": "ellipse",
            "fill": "none",
            "rx": 10,
            "ry": 10,
            "stroke": "#000000",
            "transform": "translate(168.0664,28.2138)"
        },
        {
            "type": "ellipse",
            "fill": "none",
            "rx": 10,
            "ry": 10,
            "stroke": "#000000",
            "transform": "translate(170.0952,82.0686)"
        },
        {
            "type": "ellipse",
            "fill": "none",
            "rx": 10,
            "ry": 10,
            "stroke": "#000000",
            "transform": "translate(100.0289,107.1074)"
        },
        {
            "type": "ellipse",
            "fill": "none",
            "rx": 10,
            "ry": 10,
            "stroke": "#000000",
            "transform": "translate(99.9474,150.2678)"
        },
        {
            "type": "ellipse",
            "fill": "none",
            "rx": 10,
            "ry": 10,
            "stroke": "#000000",
            "transform": "translate(64.7695,174.9972)"
        }
    ]
};
