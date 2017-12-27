﻿// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/// <reference types="node" />
/// <reference path="../typings/colors.d.ts" />
/// <reference path="../typings/nameDescription.d.ts" />

import assert = require ("assert");
import os = require ("os");
import util = require ("util");

import jsonSerializer = require ("./jsonSerializer");
import logFormathelper = require ("./logFormatHelper");
import logger = require ("./logger");
import resources = require ("./resources/resourceManager");

import JsonSerializer = jsonSerializer.JsonSerializer;
import Logger = logger.Logger;
import LogFormatHelper = logFormathelper.LogFormatHelper;

module TacoUtility {
    export class LoggerHelper {
        public static DEFAULT_INDENT: number = 3;

        private static maxRight: number = Math.floor(0.9 * (<any> process.stdout)["columns"]) || 80;  // maximum characters we're allowing in each line
        private static MINIMUM_DOTS: number = 4;
        private static MINIMUM_RIGHT_INDENT: number = 25;
        private static DEFAULT_INDENT_STRING: string = "   ";

        /**
         * Helper method to log an array of name/value pairs with proper indentation and a table header
         * @param {INameDescription} The name and description column headers
         * @param {INameDescription[]} array of name/description pairs
         * @param {number} indent1 amount of spaces to be printed before the key, if not specified default value (3) is used
         * @param {number} indent2 position at which value should start, if not specified some calculations are done to get the right indent
         * @param {string} dotsCharacter The character to use to pad between names and descriptions. Defaults to '.'
         */
        public static logNameDescriptionTableWithHeader(header: INameDescription, nameDescriptionPairs: INameDescription[], indent1?: number, indent2?: number, dotsCharacter: string = "."): void {
            // 0 is a valid indent on the left
            if (indent1 !== 0) {
                indent1 = indent1 || LoggerHelper.DEFAULT_INDENT;
            }

            if (!indent2) {
                var maxNameLength: number = LoggerHelper.getLongestNameLength([header].concat(nameDescriptionPairs));
                indent2 = LoggerHelper.getDescriptionColumnIndent(maxNameLength, indent1);
            }

            LoggerHelper.logNameDescription(util.format("<title>%s</title>", header.name), util.format("<title>%s</title>", header.description), null, null, " ");
            Logger.log(LogFormatHelper.repeat(" ", indent1) + LogFormatHelper.repeat("=", indent2 - indent1 + header.description.length));
            LoggerHelper.logNameDescriptionTable(nameDescriptionPairs, indent1, indent2, dotsCharacter);
        }

        /**
         * Helper method to log an array of name/value pairs with proper indentation
         * @param {INameDescription[]} array of name/description pairs
         * @param {number} indent1 amount of spaces to be printed before the key, if not specified default value (3) is used
         * @param {number} indent2 position at which value should start, if not specified some calculations are done to get the right indent
         * @param {string} dotsCharacter The character to use to pad between names and descriptions. Defaults to '.'
         */
        public static logNameDescriptionTable(nameDescriptionPairs: INameDescription[], indent1?: number, indent2?: number, dotsCharacter: string = "."): void {
            if (!nameDescriptionPairs || nameDescriptionPairs.length === 0) {
                return;
            }

            // 0 is a valid indent on the left
            if (indent1 !== 0) {
                indent1 = indent1 || LoggerHelper.DEFAULT_INDENT;
            }

            if (!indent2) {
                var maxNameLength: number = LoggerHelper.getLongestNameLength(nameDescriptionPairs);
                indent2 = LoggerHelper.getDescriptionColumnIndent(maxNameLength, indent1);
            }

            // if first entry has a category defined, we assume all the entries have categories and vice versa
            if (!nameDescriptionPairs[0].category) {
                nameDescriptionPairs.forEach(function (nvp: INameDescription): void {
                    if (nvp.name) {
                        LoggerHelper.logNameDescription(nvp.name, nvp.description, indent1, indent2, dotsCharacter);
                    }
                });
            } else {
                // if we are dealing with name description pairs with categories
                // we need to group these pairs into categories before logging
                var categoryGroups: { [key: string]: INameDescription[] } = {};

                // Since Object.keys doesn't guarantee an order, we need to store keys in a seperate array
                // this allows us to log name description pairs grouped by their categories as they appeared in original array
                var categories: string[] = [];

                nameDescriptionPairs.forEach(function (nvp: INameDescription): void {
                    if (nvp.name && nvp.category) {
                        if (!categoryGroups[nvp.category]) {
                            categoryGroups[nvp.category] = [];
                            categories.push(nvp.category);
                        }

                        categoryGroups[nvp.category].push(nvp);
                    }
                });

                categories.forEach(function (category: string): void {
                    Logger.logLine();
                    Logger.log(category);
                    Logger.logLine();
                    categoryGroups[category].forEach(function (nvp: INameDescription): void {
                        LoggerHelper.logNameDescription(nvp.name, nvp.description, indent1, indent2, dotsCharacter);
                    });
                });
            }
        }

        /**
         * Helper method to log an array of name/value pairs with proper indentation and horizontal borders (a line at the top and bottom)
         * @param {INameDescription[]} array of name/description pairs
         * @param {number} indent1 amount of spaces to be printed before the key, if not specified default value (3) is used
         */
        public static logNameDescriptionTableWithHorizontalBorders(nameDescriptionPairs: INameDescription[], indent1?: number): void {
            if (indent1 !== 0) {
                indent1 = indent1 || LoggerHelper.DEFAULT_INDENT;
            }

            var indentationString: string = this.repeat(" ", indent1);
            var longestNameLength: number = this.longestValueLength(nameDescriptionPairs, (e: INameDescription) => e.name);
            var longestDescriptionLength: number = this.longestValueLength(nameDescriptionPairs, (e: INameDescription) => e.description);
            var totalSeparatorLength: number = LoggerHelper.getDescriptionColumnIndent(longestNameLength, indent1) + longestDescriptionLength - indent1; // ("\t\t" + Name + ....) + Description - "\t\t"
            var sectionsSeparator: string = indentationString + LoggerHelper.repeat("-", totalSeparatorLength);
            Logger.log(sectionsSeparator);
            LoggerHelper.logNameDescriptionTable(nameDescriptionPairs, indent1);
            Logger.log(sectionsSeparator);
        }

        /**
         * Helper method to log a given name/value with proper indentation
         * @param {string} name name which comes on left. can't have any styling tags
         * @param {string} value values comes after bunch of dots. can have styling tags includeing <br/>
         * @param {number} indent1 amount of spaces to be printed before the key, if not specified default value (3) is used
         * @param {number} indent2 position at which value should start, if not specified default value (25) is used
         * @param {string} dotsCharacter The character to use to pad between names and descriptions.
         */
        public static logNameDescription(key: string, value: string, indent1: number, indent2: number, dotsCharacter: string): void {
            indent1 = indent1 || LoggerHelper.DEFAULT_INDENT;
            indent2 = indent2 || LoggerHelper.MINIMUM_RIGHT_INDENT;

            var leftIndent: string = LogFormatHelper.repeat(" ", indent1);
            var keyLength: number = LogFormatHelper.getFormattedStringLength(key);
            var dots: string = LogFormatHelper.repeat(dotsCharacter, indent2 - indent1 - keyLength - 2); // -2, for spaces around "..."
            value = LoggerHelper.wordWrapString(value, indent2, LoggerHelper.maxRight);

            var keyString: string = LogFormatHelper.isFormattedString(key) ? key : util.format("<key>%s</key>", key);

            if (value) {
                Logger.log(util.format("%s%s %s %s", leftIndent, keyString, dots, value));
            } else {
                Logger.log(util.format("%s%s", leftIndent, keyString));
            }
        }

        /**
         * Logs a separator line "==============="
         */
        public static logSeparatorLine(): void {
            Logger.log(LogFormatHelper.repeat("=", LoggerHelper.maxRight));
        }

        /**
         * Helper method to get length of longest name in the array
         * @param {INameDescription[]} array of name/description pairs
         */
        public static getLongestNameLength(nameDescriptionPairs: INameDescription[]): number {
            if (nameDescriptionPairs) {
                return nameDescriptionPairs.reduce(function (longest: number, nvp: INameDescription): number {
                    return nvp.name ? Math.max(longest, LogFormatHelper.getFormattedStringLength(nvp.name)) : longest;
                }, 0 /* initialValue */);
            }

            return 0;
        }

        /**
         * Helper method to get correct indent where values should be aligned
         * @param {number} length of the longest key to be used in the Name/Value Table <br/>
         * @param {number} indent1 amount of spaces to be printed before the key, if not specified default value (3) is used
         */
        public static getDescriptionColumnIndent(maxKeyLength: number, indent1?: number): number {
            if (indent1 !== 0) {
                indent1 = indent1 || LoggerHelper.DEFAULT_INDENT;
            }

            // +2 for spaces around dots
            return Math.max(LoggerHelper.DEFAULT_INDENT + maxKeyLength + 1 + LoggerHelper.MINIMUM_DOTS + 1, LoggerHelper.MINIMUM_RIGHT_INDENT);
        }

        /**
         * Helper method to return a repeated string  
         * @param {string} string to repeat
         * @param {string} repeat count
         */
        public static repeat(c: string, n: number): string {
            return LogFormatHelper.repeat(c, n);
        }

        /**
         * Helper method to pretty print a given json object with proper indentation
         * @param {object} object to print
         * @param {indent} constant indentation to use on the left
         */
        public static printJson(obj: any, indent?: number): void {
            var jsonSerializer: JsonSerializer = new JsonSerializer(LoggerHelper.DEFAULT_INDENT, LoggerHelper.maxRight, indent);
            Logger.log(jsonSerializer.serialize(obj));
        }

        /**
         * Logs an array of strings with proper indentation and a fixed bullet (*) (This is a list, in the sense of an HTML <ul><li></li></ul> list)
         */
        public static logList(listElements: string[]): void {
            listElements.forEach((element: string) => Logger.log(" * " + element));
        }

        /**
         * Returns the length of the longest value of the property specified with the getter
         * @param {list[]} array of elements
         * @param {propertyGetter} lambda function to extract the property we want to measure the length, from each element
         */
        private static longestValueLength<T>(list: T[], propertyGetter: { (element: T): string }): number {
            var propertyValuesLength: number[] = list.map(propertyGetter).map((str: string) => LogFormatHelper.getFormattedStringLength(str));
            return Math.max.apply(null, propertyValuesLength);
        }

        private static wordWrapString(str: string, indent: number, maxWidth: number): string {
            if (LogFormatHelper.getFormattedStringLength(str) + indent < maxWidth) {
                return str;
            }

            var leftIndent: string = LogFormatHelper.repeat(" ", indent);
            var indentedStr: string = leftIndent;

            // handle <br/>, any line breaks should start next line with indentation
            str = str.replace("<br/>", os.EOL + leftIndent);

            var words: string[] = str.split(" ");
            var currentWidth: number = indent;

            for (var i: number = 0; i < words.length; i++) {
                // +1 for space in between words
                if ((currentWidth + LogFormatHelper.getFormattedStringLength(words[i]) + 1) > maxWidth) {
                    indentedStr += os.EOL + leftIndent;
                    currentWidth = indent;
                }

                currentWidth += words[i].length + 1;
                indentedStr += words[i] + " ";
            }

            return indentedStr.substr(indent);
        }
    }
}

export = TacoUtility;
