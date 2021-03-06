﻿// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/// <reference path="../../cli/utils/settings.ts" />

import Settings = require ("../../cli/utils/settings");

class RemoteMock {
    public static makeCliMock(onError: (err: Error) => void, onClose: () => void, desiredState: { host: string; port: number; pin: string }, onQuestion?: () => void): {
            question: (question: string, callback: (answer: string) => void) => void;
            close: () => void
        } {
        return {
            question: function (question: string, callback: (answer: string) => void): void {
                switch (question) {
                    case "CommandRemoteQueryHost":
                        callback(desiredState.host);
                        break;
                    case "CommandRemoteQueryPort":
                        callback(desiredState.port.toString());
                        break;
                    case "CommandRemoteQueryPin":
                        callback(desiredState.pin);
                        break;
                    default:
                        onError(new Error("Unexpected query!"));
                }

                if (onQuestion) {
                    onQuestion();
                }
            },
            close: onClose
        };
    }

    public static saveConfig(platform: string, config: Settings.IRemoteConnectionInfo): Q.Promise<any> {
        (<any> Settings).forgetSettings();
        return Settings.loadSettings().catch(function (): Settings.ISettings {
            return { remotePlatforms: {} };
        }).then(function (settings: Settings.ISettings): Q.Promise<any> {
            if (!settings.remotePlatforms) {
                settings.remotePlatforms = {};
            }

            settings.remotePlatforms[platform] = config;
            return Settings.saveSettings(settings);
        });
    }
}

export = RemoteMock;
