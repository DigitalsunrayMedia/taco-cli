// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/// <reference types="node" />

module TacoUtility {
    export class ProcessUtils {
        public static getProcess(): NodeJS.Process {
            return process;
        }
    }
}

export = TacoUtility;
