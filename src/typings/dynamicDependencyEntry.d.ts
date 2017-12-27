/**
 *******************************************************
 *                                                     *
 *   Copyright (C) Microsoft. All rights reserved.     *
 *                                                     *
 *******************************************************
 */

/// <reference types="node" />

interface IDynamicDependencyEntry {
    packageName: string;
    packageId: string;
    localPath: string; // for development scenarios
    expirationIntervalInHours?: number;
    dev: boolean;
}
