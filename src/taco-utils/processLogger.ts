﻿// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/// <reference types="node" />
/// <reference path="../typings/tacoUtils.d.ts" />
"use strict";

import child_process = require ("child_process");
import fs = require ("fs");
import path = require ("path");

import logger = require("./logger");
import resources = require ("./resources/resourceManager");

import Logger = logger.Logger;

module TacoUtility {
    export class ProcessLogger {
        private stream: fs.WriteStream;

        constructor() {
            this.stream = null;
        }

        /**
         * Begin logging stdout and stderr of a process to a log file
         *
         * @param {string} logDir Directory to put the log in
         * @param {string} logFileName File name of the log file
         * @param {string} language Language to localize messages about the logging in
         * @param {ChildProcess} proc The process to log
         */
        public begin(logDir: string, logFileName: string, language: string, proc: child_process.ChildProcess): void {
            var pathToLog: string = path.join(logDir, logFileName);
            this.stream = fs.createWriteStream(pathToLog);
            this.stream.on("error", function (err: any): void {
                Logger.logError(resources.getStringForLanguage(language, "ProcessLogError", pathToLog, err));
            });
            var me: ProcessLogger = this;
            proc.stdout.on("data", function (data: any): void {
                me.log(data);
            });
            proc.stderr.on("data", function (data: any): void {
                me.log(data);
            });
            proc.on("exit", function (code: number): void {
                if (code) {
                    me.log(resources.getStringForLanguage(language, "LoggedProcessTerminatedWithCode", code));
                }

                me.end();
            });
        }

        /**
         * Stop logging to a file
         */
        public end(): void {
            if (this.stream) {
                this.stream.end();
            }

            this.stream = null;
        }

        private log(message: string): void {
            if (this.stream) {
                this.stream.write(message);
            }
        }
    }
}

export = TacoUtility;
