﻿// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/// <reference path="../typings/commands.d.ts" />
/// <reference types="node" />
/// <reference path="../typings/lodash.d.ts" />

"use strict";

import _ = require ("lodash");
import Q = require ("q");

import commands = require ("./commands");
import packageLoader = require ("./tacoPackageLoader");
import promisesUtils = require("./promisesUtils");
import telemetry = require("./telemetry");
import processUtils = require("./processUtils");

import Telemetry = telemetry.Telemetry;
import PromisesUtils = promisesUtils.PromisesUtils;

module TacoUtility {
    export interface ITelemetryPropertyInfo {
        value: any;
        isPii: boolean;
    }

    export interface ICommandTelemetryProperties {
        [propertyName: string]: ITelemetryPropertyInfo;
    }

    export interface IExternalTelemetryProvider {
        sendTelemetry: (event: string, props: Telemetry.ITelemetryProperties, error?: Error) => void;
    }

    interface IDictionary<T> {
        [key: string]: T;
    }

    interface IHasErrorCode {
        errorCode: number;
    }

    export abstract class TelemetryGeneratorBase {
        protected telemetryProperties: ICommandTelemetryProperties = {};
        private componentName: string;
        private currentStepStartTime: number[];
        private currentStep: string = "initialStep";
        private errorIndex: number = -1; // In case we have more than one error (We start at -1 because we increment it before using it)

        constructor(componentName: string) {
            this.componentName = componentName;
            this.currentStepStartTime = processUtils.ProcessUtils.getProcess().hrtime();
        }

        protected abstract sendTelemetryEvent(telemetryEvent: Telemetry.TelemetryEvent): void;

        public add(baseName: string, value: any, isPii: boolean): TelemetryGeneratorBase {
            return this.addWithPiiEvaluator(baseName, value, () => isPii);
        }

        public addWithPiiEvaluator(baseName: string, value: any, piiEvaluator: { (value: string, name: string): boolean }): TelemetryGeneratorBase {
            // We have 3 cases:
            //     * Object is an array, we add each element as baseNameNNN
            //     * Object is a hash, we add each element as baseName.KEY
            //     * Object is a value, we add the element as baseName
            try {
                if (Array.isArray(value)) {
                    this.addArray(baseName, <any[]> value, piiEvaluator);
                } else if (_.isObject(value)) {
                    this.addHash(baseName, <IDictionary<any>> value, piiEvaluator);
                } else {
                    this.addString(baseName, String(value), piiEvaluator);
                }
            } catch (error) {
                // We don't want to crash the functionality if the telemetry fails.
                // This error message will be a javascript error message, so it's not pii
                this.addString("telemetryGenerationError." + baseName, String(error), () => false);
            }

            return this;
        }

        public addError(error: Error): TelemetryGeneratorBase {
            this.add("error.message" + ++this.errorIndex, error, /*isPii*/ true);
            var errorWithErrorCode: IHasErrorCode = <IHasErrorCode> <Object> error;
            if (errorWithErrorCode.errorCode) {
                this.add("error.code" + this.errorIndex, errorWithErrorCode.errorCode, /*isPii*/ false);
            }

            return this;
        }

        public time<T>(name: string, codeToMeasure: { (): T }): T {
            var startTime: number[];
            return PromisesUtils.wrapExecution(
                () => startTime = processUtils.ProcessUtils.getProcess().hrtime(), // Before
                codeToMeasure,
                () => this.finishTime(name, startTime), // After
                (reason: any) => this.addError(reason)); // On failure
        }

        public step(name: string): TelemetryGeneratorBase {
            // First we finish measuring this step time, and we send a telemetry event for this step
            this.finishTime(this.currentStep, this.currentStepStartTime);
            this.sendCurrentStep();

            // Then we prepare to start gathering information about the next step
            this.currentStep = name;
            this.telemetryProperties = {};
            this.currentStepStartTime = processUtils.ProcessUtils.getProcess().hrtime();
            return this;
        }

        public send(): void {
            if (this.currentStep) {
                this.add("lastStepExecuted", this.currentStep, /*isPii*/ false);
            }

            this.step(null); // Send the last step
        }

        private sendCurrentStep(): void {
            this.add("step", this.currentStep, /*isPii*/ false);
            var telemetryEvent: Telemetry.TelemetryEvent = new Telemetry.TelemetryEvent(Telemetry.appName + "/" + this.componentName);
            TelemetryHelper.addTelemetryEventProperties(telemetryEvent, this.telemetryProperties);
            this.sendTelemetryEvent(telemetryEvent);
        }

        private addArray(baseName: string, array: any[], piiEvaluator: { (value: string, name: string): boolean }): void {
            // Object is an array, we add each element as baseNameNNN
            var elementIndex: number = 1; // We send telemetry properties in a one-based index
            array.forEach((element: any) => this.addWithPiiEvaluator(baseName + elementIndex++, element, piiEvaluator));
        }

        private addHash(baseName: string, hash: IDictionary<any>, piiEvaluator: { (value: string, name: string): boolean }): void {
            // Object is a hash, we add each element as baseName.KEY
            Object.keys(hash).forEach((key: string) => this.addWithPiiEvaluator(baseName + "." + key, hash[key], piiEvaluator));
        }

        private addString(name: string, value: string, piiEvaluator: { (value: string, name: string): boolean }): void {
            this.telemetryProperties[name] = TelemetryHelper.telemetryProperty(value, piiEvaluator(value, name));
        }

        private combine(...components: string[]): string {
            var nonNullComponents: string[] = components.filter((component: string) => !_.isNull(component));
            return nonNullComponents.join(".");
        }

        private finishTime(name: string, startTime: number[]): void {
            var endTime: number[] = processUtils.ProcessUtils.getProcess().hrtime(startTime);
            this.add(this.combine(name, "time"), String(endTime[0] * 1000 + endTime[1] / 1000000), /*isPii*/ false);
        }
    }

    export class TelemetryGenerator extends TelemetryGeneratorBase {
        protected sendTelemetryEvent(telemetryEvent: Telemetry.TelemetryEvent): void {
            Telemetry.send(telemetryEvent);
        }
    }

    export class TelemetryHelper {
        public static telemetryProperty(propertyValue: any, pii?: boolean): ITelemetryPropertyInfo {
            return { value: String(propertyValue), isPii: pii || false };
        }

        public static addTelemetryEventProperties(event: Telemetry.TelemetryEvent, properties: ICommandTelemetryProperties): void {
            if (!properties) {
                return;
            }

            Object.keys(properties).forEach(function (propertyName: string): void {
                TelemetryHelper.addTelemetryEventProperty(event, propertyName, properties[propertyName].value, properties[propertyName].isPii);
            });
        }

        public static sendCommandFailureTelemetry(commandName: string, error: any, projectProperties: ICommandTelemetryProperties, args: string[] = null): void {
            var errorEvent: Telemetry.TelemetryEvent = TelemetryHelper.createBasicCommandTelemetry(commandName, args);

            if (error.isTacoError) {
                errorEvent.properties["tacoErrorCode"] = error.errorCode;
                errorEvent.properties["tacoErrorName"] = error.name;
            } else if (error.message) {
                errorEvent.setPiiProperty("errorMessage", error.message);
            }

            TelemetryHelper.addTelemetryEventProperties(errorEvent, projectProperties);

            Telemetry.send(errorEvent);
        }

        public static sendCommandSuccessTelemetry(commandName: string, commandProperties: ICommandTelemetryProperties, args: string[] = null): void {
            var successEvent: Telemetry.TelemetryEvent = TelemetryHelper.createBasicCommandTelemetry(commandName, args);

            TelemetryHelper.addTelemetryEventProperties(successEvent, commandProperties);

            Telemetry.send(successEvent);
        }

        public static addTelemetryEventProperty(event: Telemetry.TelemetryEvent, propertyName: string, propertyValue: any, isPii: boolean): void {
            if (Array.isArray(propertyValue)) {
                TelemetryHelper.addMultiValuedTelemetryEventProperty(event, propertyName, propertyValue, isPii);
            } else {
                TelemetryHelper.setTelemetryEventProperty(event, propertyName, propertyValue, isPii);
            }
        }

        public static addPropertiesFromOptions(telemetryProperties: ICommandTelemetryProperties, knownOptions: Nopt.CommandData,
            commandOptions: { [flag: string]: any }, nonPiiOptions: string[] = []): ICommandTelemetryProperties {
            // We parse only the known options, to avoid potential private information that may appear on the command line
            var unknownOptionIndex: number = 1;
            Object.keys(commandOptions).forEach((key: string) => {
                var value: any = commandOptions[key];
                if (Object.keys(knownOptions).indexOf(key) >= 0) {
                    // This is a known option. We'll check the list to decide if it's pii or not
                    if (typeof (value) !== "undefined") {
                        // We encrypt all options values unless they are specifically marked as nonPii
                        telemetryProperties["options." + key] = this.telemetryProperty(value, nonPiiOptions.indexOf(key) < 0);
                    }
                } else {
                    // This is a not known option. We'll assume that both the option and the value are pii
                    telemetryProperties["unknownOption" + unknownOptionIndex + ".name"] = this.telemetryProperty(key, /*isPii*/ true);
                    telemetryProperties["unknownOption" + unknownOptionIndex++ + ".value"] = this.telemetryProperty(value, /*isPii*/ true);
                }
            });
            return telemetryProperties;
        }

        public static generate<T>(name: string, codeGeneratingTelemetry: { (telemetry: TelemetryGenerator): T }): T {
            var generator: TelemetryGenerator;
            return PromisesUtils.wrapExecution(
                () => generator = new TelemetryGenerator(name), // Before
                () => generator.time(null, () => codeGeneratingTelemetry(generator)),
                () => generator.send()); // After
        }

        /**
         * Creates an object that can be passed to external modules to report telemetry events.
         * @param componentName - a name to prefix on the telemetry event names received from the external module.
         * @param baseProps - a collection of properties to include with all events.
         * @param errorHandler - an optional function to wrap or modify any errors (wrap in a TacoError, for example).
         * @returns {{sendTelemetry: (function(string, ITelemetryProperties, Error=): void)}}
         */
        public static getExternalTelemetryObject(componentName: string, baseProps: Telemetry.ITelemetryProperties, errorHandler?: (error: Error) => Error): IExternalTelemetryProvider {
            return {
                sendTelemetry: function (event: string, props: Telemetry.ITelemetryProperties, error?: Error): void {
                    var telemetryProperties: ICommandTelemetryProperties = {};
                    TelemetryHelper.addTelemetryProperties(telemetryProperties, baseProps);
                    TelemetryHelper.addTelemetryProperties(telemetryProperties, props);
                    var name = componentName + "/" + event;
                    if (error) {
                        if (errorHandler) {
                            error = errorHandler(error);
                        }
                        TelemetryHelper.sendCommandFailureTelemetry(name, error, telemetryProperties);
                    } else {
                        TelemetryHelper.sendCommandSuccessTelemetry(name, telemetryProperties);
                    }
                }
            };
        }

        private static addTelemetryProperties(telemetryProperties: ICommandTelemetryProperties, newProps: Telemetry.ITelemetryProperties): void {
            Object.keys(newProps).forEach(function (propName: string): void {
                telemetryProperties[propName] = TelemetryHelper.telemetryProperty(newProps[propName]);
            });
        }

        private static createBasicCommandTelemetry(commandName: string, args: string[] = null): Telemetry.TelemetryEvent {
            var commandEvent: Telemetry.TelemetryEvent = new Telemetry.TelemetryEvent(Telemetry.appName + "/" + (commandName || "command"));

            if (!commandName && args && args.length > 0) {
                commandEvent.setPiiProperty("command", args[0]);
            }

            if (args) {
                TelemetryHelper.addTelemetryEventProperty(commandEvent, "argument", args, true);
            }

            return commandEvent;
        }

        private static setTelemetryEventProperty(event: Telemetry.TelemetryEvent, propertyName: string, propertyValue: string, isPii: boolean): void {
            if (isPii) {
                event.setPiiProperty(propertyName, String(propertyValue));
            } else {
                event.properties[propertyName] = String(propertyValue);
            }
        }

        private static addMultiValuedTelemetryEventProperty(event: Telemetry.TelemetryEvent, propertyName: string, propertyValue: string, isPii: boolean): void {
            for (var i: number = 0; i < propertyValue.length; i++) {
                TelemetryHelper.setTelemetryEventProperty(event, propertyName + i, propertyValue[i], isPii);
            }
        }
    };
}

export = TacoUtility;
