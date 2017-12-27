/**
 *******************************************************
 *                                                     *
 *   Copyright (C) Microsoft. All rights reserved.     *
 *                                                     *
 *******************************************************
 */

/// <reference types="node" />
declare module "iconv-lite" {

    export function decode(b: Buffer, encoding: string): string;
}