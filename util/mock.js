class mockOption {
    constructor () {
        this.integerMap = {};
        this.stringMap = {};
        this.subcommand = null;
    }
    setString(name, value) {
        this.stringMap[name] = value
    }
    getString(name) {
        return this.stringMap[name];
    }
    setInteger(name, value) {
        this.integerMap[name] = value;
    }
    getInteger(name) {
        return this.integerMap[name];
    }
    setSubcommand(name) {
        return this.subcommand = name;
    }
    getSubcommand() {
        return this.subcommand;
    }
}

class mockInteraction {
    constructor() {
        this.mockOptions = new mockOption();
        this.user = {id: "1234567890"}
    }
    get options(){
        return this.mockOptions;
    }
}

export {mockInteraction}