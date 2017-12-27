/**
 *******************************************************
 *                                                     *
 *   Copyright (C) Microsoft. All rights reserved.     *
 *                                                     *
 *******************************************************
 */

/// <reference types="node" />

interface IProjectInfo {
    isTacoProject: boolean;
    cordovaCliVersion: string;
    configXmlPath: string;
    tacoKitId?: string;
}
