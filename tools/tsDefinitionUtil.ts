// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/// <reference types="node" />
/// <reference path="../src/typings/Q.d.ts" />
/// <disable code="SA1301" justification="it is more standard to use 'Q'" />
import Q = require ("q");
/// <enable code="SA1301" />
var exec = require("child_process").exec;
var fs = require("fs");
var path = require("path");
var del = require("del");
var ncp = require("ncp");

/*utility to generate .d.ts file*/
export module DefinitionServices {
    export function generateTSExportDefinition(fileName: string, srcFolderPath: string, destFolderPath: string, moduleName: string, moduleString: string): Q.Promise<any> {
        var destDtsFile: string = path.join(destFolderPath, fileName + ".d.ts");
        return Q(compileDeclarationFile(fileName, srcFolderPath)).
            then(function (): void { copyDTSTypings(fileName, srcFolderPath, destFolderPath); }).
            then(function (): void { addExportsInTypings(destDtsFile, moduleName, moduleString); });
    }

    /*call tsc --d, only option is to generate it in same folder as .ts*/
    function compileDeclarationFile(tsFileName: string, srcFolderPath: string): Q.Promise<any> {
        var d = Q.defer();
        var srcTsFilePath: string = path.join(srcFolderPath, tsFileName + ".ts");
        var tscCommand: string = "tsc --d " + srcTsFilePath + " --module commonjs";
        console.log("---calling: " + tscCommand);

        exec(tscCommand, { cwd: "." }, function (error: any, stdout: any, stderr: any): void {
            if (error) {
                return d.reject(error);
            } else {
                d.resolve(stdout);
            }
        });
        return d.promise;
    }

    function copyDTSTypings(tsFileName: string, srcFolderPath: string, destFolderPath: string): void {
        var srcDTSFilePath: string = path.join(srcFolderPath, tsFileName + ".d.ts");
        var srcJSFilePath: string = path.join(srcFolderPath, tsFileName + ".js");
        var destDTSFilePath: string = path.join(destFolderPath, tsFileName + ".d.ts");
        console.log("copying: " + srcDTSFilePath + " to :" + destDTSFilePath);
        fs.writeFileSync(destDTSFilePath, fs.readFileSync(srcDTSFilePath));   
        del([srcDTSFilePath], { force: true });   
        del([srcJSFilePath], { force: true });        
    }

    /*add wrap everything except ///<reference>s with "declare module "moduleString"{}"*/
    function addExportsInTypings(dtsPath: string, moduleName: string, moduleString: string): void {
        console.log("---processing:  " + dtsPath);
        var buf: string = fs.readFileSync(dtsPath, "utf8");
        var result: string= buf.replace("declare module " + moduleName, "module " + moduleName);
        var regex: string = "(module " + moduleName + ")|(import)";
        var match: string[] = buf.match(regex);
        if (match && match[0]) {
            var foundMatch = match[0];
            result = result.replace(foundMatch, "declare module \"" + moduleString + "\" {\n" + foundMatch) + "\n}\n";
        }
        fs.writeFileSync(dtsPath, result, "utf8");
    }
}
