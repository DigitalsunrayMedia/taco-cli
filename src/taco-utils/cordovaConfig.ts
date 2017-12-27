﻿// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/// <reference types="node" />
/// <reference path="../typings/elementtree.d.ts" />
/// <reference path="../typings/unorm.d.ts" />

import et = require ("elementtree");
import fs = require ("fs");
import path = require ("path");

/* tslint:disable:no-var-requires */
var unorm: any = require ("unorm"); // Note no import: the compiler will remove the require since we don't use the unorm object, we just need it to add String.normalize
/* tslint:enable:no-var-requires */

import tacoUtility = require ("./utilHelper");
import UtilHelper = tacoUtility.UtilHelper;

module TacoUtility {
    export class CordovaConfig {
        /** CordovaConfig is a class for parsing the config.xml file for Cordova projects */
        private doc: et.ElementTree;

        constructor(configXmlPath: string) {
            var contents: string = UtilHelper.readFileContentsSync(configXmlPath, "utf-8");
            this.doc = new et.ElementTree(et.XML(contents));
        }

        /**
         * Helper method to get a CordovaConfig object for a cordova project
         */
        public static getCordovaConfig(cordovaDirPath: string): CordovaConfig {
            return new CordovaConfig(path.join(cordovaDirPath, "config.xml"));
        }

        /**
         * Get the package ID
         *
         * @returns {string} The packageID
         */
        public id(): string {
            return this.doc.getroot().attrib["id"];
        }

        /**
         * Get the app's Display Name
         *
         * @returns {String} The display name, normalized to NFC
         */
        public name(): string {
            var el: et.XMLElement = this.doc.find("name");
            return el && el.text && el.text.trim().normalize();
        }

        /**
         * Get the package version
         *
         * @returns {string} The version
         */
        public version(): string {
            var el: et.XMLElement = this.doc.getroot();
            return el && el.attrib && el.attrib["version"];
        }

        /**
         * Get the preferences specified in the config
         *
         * @returns {[key: string]: string} A dictionary mapping preference keys to preference values
         */
        public preferences(): { [key: string]: string } {
            var data: { [key: string]: string } = {};
            var preferences: et.XMLElement[] = this.doc.findall("preference");
            preferences.forEach(function (preference: et.XMLElement): void {
                data[preference.attrib["name"]] = preference.attrib["value"];
            });

            return data;
        }

        /**
         * Get the engines specified in the config
         *
         * @returns {[key: string]: string} A dictionary mapping engine keys to spec values
         */
        public engines(): { [key: string]: string } {
            var data: { [key: string]: string } = {};
            var engines: et.XMLElement[] = this.doc.findall("engine");
            engines.forEach(function (engine: et.XMLElement): void {
                data[engine.attrib["name"]] = engine.attrib["spec"];
            });

            return data;
        }
    }
}

export = TacoUtility;
