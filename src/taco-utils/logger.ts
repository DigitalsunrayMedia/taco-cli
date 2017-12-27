﻿// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/// <reference types="node" />
/// <reference path="../typings/logger.d.ts" />

import os = require ("os");

import logFormathelper = require ("./logFormatHelper");

import LogFormatHelper = logFormathelper.LogFormatHelper;

module TacoUtility {
    export class Logger {
        /**
         * message can be any string with xml type tags in it.
         * supported tags can be seen in logger.ts
         * <blue><bold>Hello World!!!</bold></blue>
         * if using any kind of formatting, make sure that it is well formatted
         */
        public static log(message: string): void {
            if (message || message === "") {
                Logger.stdout(LogFormatHelper.toFormattedString(message));
            }
        }

        /**
         * Logs an error string followed by a newline on stderr
         * input string can only have <br/> tags
         */
        public static logError(message: string): void {
            if (message || message === "") {
                Logger.stderr(LogFormatHelper.toError(message));
            }
        }

        /**
         * Logs a warning string followed by a newline on stderr
         * input string can only have <br/> tags
         */
        public static logWarning(message: string): void {
            if (message || message === "") {
                Logger.stderr(LogFormatHelper.toWarning(message));
            }
        }

        /**
         * Logs an empty line on console
         */
        public static logLine(): void {
            Logger.stdout(os.EOL);
        }

        private static stdout(msg: string): void {
            process.stdout.write(msg);
        }

        private static stderr(msg: string): void {
            process.stderr.write(msg);
        }
    }
}

export = TacoUtility;
