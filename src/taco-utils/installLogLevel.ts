// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/// <reference types="node" />

"use strict";
module TacoUtility {
    export enum InstallLogLevel {
        undefined = 0, // undefined is falsy, others are truthy
        silent = 1,
        taco,
        error,
        warn,
        info,
        verbose,
        silly,
    }
}

export = TacoUtility;
