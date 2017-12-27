/**
 *******************************************************
 *                                                     *
 *   Copyright (C) Microsoft. All rights reserved.     *
 *                                                     *
 *******************************************************
 */

/// <reference types="node" />
/// <reference path="../typings/commands.d.ts" />

declare module TacoUtility {
    interface ITelemetryPropertyInfo {
        value: any;
        isPii: boolean;
    }

    interface ICommandTelemetryProperties {
        [propertyName: string]: ITelemetryPropertyInfo;
    }

    interface IExternalTelemetryProvider {
        sendTelemetry: (event: string, props: Telemetry.ITelemetryProperties, error?: Error) => void;
    }

    class TelemetryGeneratorBase {
        protected telemetryProperties: ICommandTelemetryProperties;
        public constructor(componentName: string);
        public time<T>(name: string, codeToMeasure: { (): T }): T;
        public step(name: string): TelemetryGeneratorBase;
        public add(baseName: string, value: any, isPii: boolean): TelemetryGeneratorBase;
        public addWithPiiEvaluator(baseName: string, value: any, piiEvaluator: { (value: string, name: string): boolean }): TelemetryGeneratorBase;
        public send(): void;
        public addError(error: Error): TelemetryGeneratorBase;
    }

    class TelemetryGenerator extends TelemetryGeneratorBase {
    }

    interface TelemetryGeneratorFactory {
        generate<T>(componentName: string, codeGeneratingTelemetry: { (telemetry: TelemetryGeneratorBase): T }): T;
    }

    class TelemetryHelper {
        static telemetryProperty(propertyValue: any, isPii?: boolean): ITelemetryPropertyInfo;
        public static addPropertiesFromOptions(telemetryProperties: ICommandTelemetryProperties, knownOptions: Nopt.CommandData,
            commandOptions: { [flag: string]: any }, nonPiiOptions?: string[]): ICommandTelemetryProperties;
        static sendCommandSuccessTelemetry(commandName: string, commandProperties: ICommandTelemetryProperties, args?: string[]): void;
        static sendCommandFailureTelemetry(commandName: string, error: any, properties: ICommandTelemetryProperties, args?: string[]): void;
        static addTelemetryEventProperty(event: Telemetry.TelemetryEvent, propertyName: string, propertyValue: any, isPii: boolean): void;
        static addTelemetryEventProperties(event: Telemetry.TelemetryEvent, properties: ICommandTelemetryProperties): void;
        static addPropertiesFromOptions(telemetryProperties: ICommandTelemetryProperties, knownOptions: Nopt.CommandData,
             commandOptions: { [flag: string]: any }, nonPiiOptions?: string[]): ICommandTelemetryProperties;
        static addObjectToTelemetry(telemetryProperties: ICommandTelemetryProperties, baseName: string, value: any, isPii: boolean): void;
        static generate<T>(componentName: string, codeGeneratingTelemetry: { (telemetry: TelemetryGeneratorBase): T }): T;
        static getExternalTelemetryObject(componentName: string, baseProps: TacoUtility.Telemetry.ITelemetryProperties, errorHandler?: (error: Error) => TacoError): IExternalTelemetryProvider;
    }
}
