/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const attrPath: SvgaCaseJson = {
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
            "d": "M150,68L182,125.6L118,125.6L150,68z",
            "fill": "#0091ff",
            "stroke": "none",
            "transform": "translate(-8,-51.6636)"
        },
        {
            "type": "path",
            "d": "M140.9242,81.5765L126.4928,107.5529L155.3556,107.5529L140.9242,81.5765zM140.9242,55.6L177.6262,121.6636L104.2222,121.6636L140.9242,55.6z",
            "fill": "#0091ff",
            "stroke": "none",
            "transform": "translate(162.3738,151.2)translate(-150,-96.8)"
        },
        {
            "type": "path",
            "d": "M42.497,68C59.7534,68,76.2638,98.5951,67.6383,113.2543C59.0128,127.9136,25.9812,127.9136,17.3557,113.2543C8.7302,98.5951,25.2407,68,42.497,68z",
            "fill": "#0091ff",
            "stroke": "none",
            "transform": "translate(10,55.7512)"
        },
        {
            "type": "path",
            "d": "M0,0L20,-40L50,-10L70,-60",
            "fill": "none",
            "stroke": "#0091ff",
            "strokeWidth": 4,
            "transform": "translate(20,70)"
        },
        {
            "type": "path",
            "d": "M0,0C0,0,5.2854,-37.6121,20,-40C33.9595,-42.2653,36.1467,-7.1565,50,-10C67.584,-13.6092,70,-60,70,-60",
            "fill": "none",
            "stroke": "#0091ff",
            "strokeWidth": 4,
            "transform": "translate(20,120)"
        }
    ]
};
