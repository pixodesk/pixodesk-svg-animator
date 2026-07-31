/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const effectCloneStatic: SvgaCaseJson = {
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
            "id": "_px_38bqgqqp",
            "cx": -3,
            "cy": -15,
            "fill": "#4d80e6",
            "rx": 15,
            "ry": 10,
            "stroke": "none",
            "transform": "translate(42.508,40.9547)",
            "meta": {
                "label": "source-static"
            }
        },
        {
            "type": "path",
            "id": "_px_38nb5h1o",
            "d": "M10,10L1.1062,6.984L-6.4204,12.6007L-6.3004,3.2102L-13.968,-2.2123L-5,-5L-2.2123,-13.968L3.2102,-6.3004L12.6007,-6.4204L6.984,1.1062L10,10z",
            "fill": "#007fff",
            "stroke": "none",
            "transform": "translate(40.1916,99.1461)",
            "meta": {
                "appliedEffects": {
                    "shape": {
                        "value": {
                            "preset": {
                                "type": "star",
                                "points": 5,
                                "innerRadius": 7.0710678118654755,
                                "radius": 14.142135623730951,
                                "startAngle": 135
                            }
                        }
                    }
                }
            }
        },
        {
            "type": "path",
            "id": "_px_38nb5h1q",
            "d": "M0,0L12.9098,-6.4549C14.7902,-7.3951,16.9672,-7.5498,18.9617,-6.885C20.9562,-6.2202,22.6049,-4.7902,23.5451,-2.9098L30,10L0,0z",
            "fill": "#007fff",
            "stroke": "none",
            "transform": "translate(24.508,60.5664)",
            "meta": {
                "appliedEffects": {
                    "shape": {
                        "value": {
                            "corners": [
                                {
                                    "pointIndex": 1,
                                    "r": 7.9271
                                }
                            ],
                            "path": "M0,0L20,-10L30,10L0,0z"
                        }
                    }
                }
            }
        },
        {
            "type": "text",
            "id": "_px_38nb5h1m",
            "transform": "translate(20.0127,138.0706)",
            "xml:space": "preserve",
            "style": {
                "white-space": "pre"
            },
            "meta": {
                "appliedEffects": {
                    "text": {
                        "fontSource": "browser"
                    }
                }
            },
            "children": [
                {
                    "type": "tspan",
                    "fill": "#4d33b3",
                    "fontFamily": "Courier",
                    "fontSize": "13px",
                    "text": "Apple",
                    "xml:space": "preserve",
                    "style": {
                        "white-space": "pre"
                    },
                    "children": [
                        {
                            "type": "tspan",
                            "fill": "#4d33b3",
                            "fontFamily": "Courier",
                            "fontSize": "13px",
                            "text": "Apple",
                            "xml:space": "preserve",
                            "style": {
                                "white-space": "pre"
                            }
                        }
                    ]
                }
            ]
        },
        {
            "type": "ellipse",
            "id": "_px_38nb5h1k",
            "fill": "#007fff",
            "rx": 5,
            "ry": 5,
            "stroke": "none",
            "transform": "translate(39.508,160.9547)",
            "effects": {
                "repeater": {
                    "copies": 5,
                    "origin": [
                        0,
                        10
                    ],
                    "rotate": 72
                }
            }
        },
        {
            "type": "use",
            "href": "#_px_38nii7pq",
            "transform": "translate(110,40.9547)",
            "effects": {
                "clone": {
                    "baseId": "_px_38bqgqqp",
                    "type": "content"
                }
            }
        },
        {
            "type": "use",
            "href": "#_px_38bqgqqp",
            "transform": "translate(130,0)"
        },
        {
            "type": "use",
            "href": "#_px_38nii7pp",
            "transform": "translate(95,60.5664)",
            "effects": {
                "clone": {
                    "baseId": "_px_38nb5h1q",
                    "type": "content"
                }
            }
        },
        {
            "type": "use",
            "href": "#_px_38nb5h1q",
            "transform": "translate(130,0)"
        },
        {
            "type": "use",
            "href": "#_px_38nii7po",
            "transform": "translate(110,99.1461)",
            "effects": {
                "clone": {
                    "baseId": "_px_38nb5h1o",
                    "type": "content"
                }
            }
        },
        {
            "type": "use",
            "href": "#_px_38nb5h1o",
            "transform": "translate(130,0)"
        },
        {
            "type": "use",
            "href": "#_px_38nii7pn",
            "transform": "translate(90,138.0706)",
            "effects": {
                "clone": {
                    "baseId": "_px_38nb5h1m",
                    "type": "content"
                }
            }
        },
        {
            "type": "use",
            "href": "#_px_38nb5h1m",
            "transform": "translate(130,0)"
        },
        {
            "type": "use",
            "href": "#_px_38nii7pm",
            "transform": "translate(105,160.9547)",
            "effects": {
                "clone": {
                    "baseId": "_px_38nb5h1k",
                    "type": "content"
                }
            }
        },
        {
            "type": "use",
            "href": "#_px_38nb5h1k",
            "transform": "translate(130,0)"
        }
    ]
};
