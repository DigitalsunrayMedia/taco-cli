// Type definitions for gulp-sourcemaps
// Project: https://github.com/floridoo/gulp-sourcemaps
// Definitions by: Asana <https://asana.com>
// Definitions: https://github.com/borisyankov/DefinitelyTyped

declare module GulpJsonEditor {
    export function jeditor(editorFunction: any, jsBeautifyOptions?: any): NodeJS.ReadWriteStream;
}
declare module "gulp-json-editor" {
    import jeditor = GulpJsonEditor.jeditor;
    export = jeditor;
}