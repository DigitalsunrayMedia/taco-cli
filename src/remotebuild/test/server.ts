﻿// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/// <reference path="../../typings/mocha.d.ts" />
/// <reference path="../../typings/node.d.ts" />
/// <reference path="../../typings/request.d.ts" />
/// <reference path="../../typings/should.d.ts" />
"use strict";

/* tslint:disable:no-var-requires */
// var require needed for should module to work correctly
// Note not import: We don't want to refer to shouldModule, but we need the require to occur since it modifies the prototype of Object.
var shouldModule: any = require("should");
/* tslint:enable:no-var-requires */

import fs = require ("fs");
import nconf = require ("nconf");
import net = require ("net");
import os = require ("os");
import path = require ("path");
import request = require ("request");
import rimraf = require ("rimraf");
import Q = require ("q");

import HostSpecifics = require ("../lib/hostSpecifics");
import RemoteBuildConf = require ("../lib/remoteBuildConf");
import resources = require ("../resources/resourceManager");
import server = require ("../lib/server");
import tacoUtils = require ("taco-utils");
import testServerModuleFactory = require ("./testServerModuleFactory");

var serverDir: string = path.join(os.tmpdir(), "remotebuild", "server");
var certsDir: string = path.join(serverDir, "certs");
var clientCertsDir: string = path.join(certsDir, "client");

var darwinOnlyTest: (expectation: string, assertion?: (done: MochaDone) => void) => void = os.platform() === "darwin" ? it : it.skip;

describe("server", function (): void {
    before(function (): void {
        // Clear out settings for nconf
        nconf.overrides({});
        nconf.defaults({});
        nconf.use("memory");
        nconf.reset();
    });
    after(function (): void {
        rimraf(serverDir, function (err: Error): void {/* ignored */ }); // Not sync, and ignore errors
    });
    beforeEach(function (): void {
        rimraf.sync(serverDir);
    });
    afterEach(function (done: MochaDone): void {
        try {
            server.stop(done);
        } catch (e) {
            done();
        }
    });

    it("should start correctly in insecure mode", function (done: MochaDone): void {
        // TODO: Remove the casting once we've get some complete/up-to-date .d.ts files. See https://github.com/Microsoft/TACO/issues/18
        nconf.overrides(<nconf.IOptions> { serverDir: serverDir, port: 3000, secure: false, lang: "en" });
        server.start(new RemoteBuildConf(nconf, true))
            .then(function (): void {
            fs.existsSync(serverDir).should.be.true;
            fs.existsSync(certsDir).should.be.false;
        }).then(function (): Q.Promise<{}> {
            var deferred: Q.Deferred<any> = Q.defer();
            request.get("http://localhost:3000", function (error: any, response: any, body: any): void {
                response.statusCode.should.equal(200);
                deferred.resolve({});
            });
            return deferred.promise;
        }).done(function (): void { done(); }, done);
    });

    it("should fail gracefully if the port is taken", function (done: MochaDone): void {
        var dummyServer: net.Server = net.createServer(function (c: net.Socket): void {
            // Don't care about connections, we just want to use up a port
        });

        var deferred: Q.Deferred<any>  = Q.defer();
        dummyServer.listen(3000, function (): void {
            deferred.resolve({});
        });

        deferred.promise.then(function (): Q.Promise<any> {
            // TODO: Remove the casting once we've get some complete/up-to-date .d.ts files. See https://github.com/Microsoft/TACO/issues/18
            nconf.overrides(<nconf.IOptions> { serverDir: serverDir, port: 3000, secure: false, lang: "en" });
            return server.start(new RemoteBuildConf(nconf, true));
        }).then(function (): void {
            dummyServer.close(function (): void {
                done(new Error("Server should not start successfully when the port is already taken!"));
            });
        }, function (err: any): void {
                dummyServer.close(function (): void {
                    if (err === "Unable to start server on port 3000. Address already in use.") {
                        done(); // Server should error out
                    } else {
                        done(new Error("Unexpected error: " + err));
                    }
                });
            });
    });

    // TODO (Devdiv: 1160573): Still need to work out how windows should work with certificates.
    darwinOnlyTest("should start correctly in secure mode on mac", function (done: MochaDone): void {
        // TODO: Remove the casting once we've get some complete/up-to-date .d.ts files. See https://github.com/Microsoft/TACO/issues/18
        nconf.overrides(<nconf.IOptions> { serverDir: serverDir, port: 3000, secure: true, lang: "en" });
        server.start(new RemoteBuildConf(nconf, true))
            .then(function (): void {
            fs.existsSync(serverDir).should.be.ok;
            fs.existsSync(certsDir).should.be.ok;

            fs.existsSync(path.join(certsDir, "server-key.pem")).should.be.ok;
            fs.existsSync(path.join(certsDir, "server-cert.pem")).should.be.ok;
            fs.existsSync(path.join(certsDir, "ca-key.pem")).should.be.ok;
            fs.existsSync(path.join(certsDir, "ca-cert.pem")).should.be.ok;
        }).then(function (): Q.Promise<{}> {
            var deferred: Q.Deferred<any> = Q.defer();
            // Disabling strict SSL for unit testing
            request.get({ url: "https://localhost:3000", strictSSL: false }, function (error: any, response: any, body: any): void {
                response.statusCode.should.equal(200);
                deferred.resolve({});
            });
            return deferred.promise;
        }).done(function (): void { done(); }, done);
    });

    darwinOnlyTest("should be able to download a certificate exactly once on mac", function (done: MochaDone): void {
        // TODO: Remove the casting once we've get some complete/up-to-date .d.ts files. See https://github.com/Microsoft/TACO/issues/18
        nconf.overrides(<nconf.IOptions> { serverDir: serverDir, port: 3000, secure: true, lang: "en", pinTimeout: 10 });
        var config: RemoteBuildConf = new RemoteBuildConf(nconf, true);
        HostSpecifics.hostSpecifics.initialize(config).then(function (): Q.Promise<any> {
            return server.start(config);
        }).then(function (): void {
            fs.existsSync(clientCertsDir).should.be.ok;
        }).then(function (): Q.Promise<string> {
            var pins: string[]  = fs.readdirSync(clientCertsDir);
            pins.length.should.equal(1);
            var downloadedPin: string = pins[0];
            var clientPfxSize: number = fs.statSync(path.join(clientCertsDir, downloadedPin, "client.pfx")).size;
            clientPfxSize.should.be.greaterThan(0);

            var deferred: Q.Deferred<string> = Q.defer<string>();
            // turn off strict SSL for unit testing
            var downloadedCertPath: string = path.join(serverDir, "downloaded-client.pfx");
            var downloadRequest: request.Request = request.get({ url: "https://localhost:3000/certs/" + downloadedPin, strictSSL: false });
            var writeStream: fs.WriteStream = fs.createWriteStream(downloadedCertPath);
            downloadRequest.pipe(writeStream);
            downloadRequest.on("error", done);
            writeStream.on("finish", function (): void {
                var downloadedPfxSize: number = fs.statSync(downloadedCertPath).size;
                if (downloadedPfxSize !== clientPfxSize) {
                    done(new Error("Download size does not match!"));
                }

                deferred.resolve(downloadedPin);
            });
            return deferred.promise;
        }).then(function (downloadedPin: string): Q.Promise<{}> {
            var deferred: Q.Deferred<any> = Q.defer();
            request.get({ url: "https://localhost:3000/certs/" + downloadedPin, strictSSL: false }, function (error: any, response: any, body: any): void {
                response.statusCode.should.equal(404);
                deferred.resolve({});
            });
            return deferred.promise;
        }).done(function (): void { done(); }, done);
    });

    it("should load server modules and serve requests from there", function (mocha: MochaDone): void {
        var modPath: string = path.join("..", "test", "testServerModuleFactory"); // path is relative to lib/server.js since that's where the require is invoked
        var testModules: { [key: string]: any } = {};
        testModules["testServerModuleFactory"] = { mountPath: "testRoute", requirePath: modPath };

        // TODO: Remove the casting once we've get some complete/up-to-date .d.ts files. See https://github.com/Microsoft/TACO/issues/18
        nconf.overrides(<nconf.IOptions> { serverDir: serverDir, port: 3000, secure: false, lang: "en", pinTimeout: 10, modules: testModules });
        server.start(new RemoteBuildConf(nconf, true)).then(function (): void {
            testServerModuleFactory.TestServerModule.modConfig.mountPath.should.equal("testRoute");
        }).then(function (): Q.Promise<any> {
            var deferred: Q.Deferred<any> = Q.defer();
            request.get("http://localhost:3000/testRoute/foo", function (error: any, response: any, body: any): void {
                response.statusCode.should.equal(200);
                deferred.resolve({});
            });
            return deferred.promise;
            }).then(function (): void {
            testServerModuleFactory.TestServerModule.lastReq.url.should.equal("/foo");
        }).done(function (): void {
            mocha();
        }, mocha);
    });
});
