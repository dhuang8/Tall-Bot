"use strict";
const assert = require('assert');

class Command {
    constructor(options) {
        if (!options || !options.name) throw new Error("missing options, name, regex, or function");
        this.name = options.name;
        this.prefix = options.prefix || ".";
        //require prefix
        this.requirePrefix = options.require || false;
        this.shortDesc = options.shortDesc || "";
        this.longDesc = options.longDesc || "";
        this.testString = options.testString || ""
        //won't run if one is false
        if (options.softAsserts) {
            if (!Array.isArray(options.softAsserts)) {
                this.softAsserts = [options.softAsserts];
            } else {
                this.softAsserts = options.softAsserts;
            }
        } else {
            this.softAsserts = [];
        }
        
        //same as softasserts but also will not show up in help if 1 is false
        if (options.hardAsserts) {
            if (!Array.isArray(options.hardAsserts)) {
                this.hardAsserts = [options.hardAsserts];
            } else {
                this.hardAsserts = options.hardAsserts;
            }
        } else {
            this.hardAsserts = [];
        }

        this.func = options.func || (()=>{return true;});
        this.regex = options.regex || null;
        this.hidden = options.hidden || false;
    }

    _testHardRequirements() {
        return this._testRequirements(this.hardAsserts);
    }

    _testSoftRequirements() {
        return this._testRequirements(this.softAsserts);
    }

    _testRequirements(asserts) {
        for (let i=0;i<asserts.length;i++) {
            if (typeof asserts[i] == "function" && !asserts[i]()) return false;
            else if (!asserts[i]) return false;
        }
        return true;
    }

    run(message) {
        let args;
        let messageString = message.content;
        if (this.requirePrefix && messageString[0] !== this.prefix) return false;
        else if (messageString.indexOf(this.prefix) == 0) messageString = messageString.slice(this.prefix.length);
        if (this._testHardRequirements() && this._testSoftRequirements() && (this.regex == null || (args = this.regex.exec(messageString)))) {
            return this.func(message, args);
        }
        return false;
    }

    getVisibility() {
        if (this.hidden || !this._testHardRequirements()) return false;
        return true;
    }

    getShortDesc() {
        return `${this.prefix}${this.name} - ${this.shortDesc}`;
    }

    getLongDesc() {
        return `${this.longDesc}`;
    }

    toString() {
        return "lol";
    }
}
module.exports = Command;