class Command {
type_constant = {
	"PREFIX": 1, 
	"SLASH": 2, 
	"BOTH": 3
}
constructor(data) {
	this.name = data.name;
	this.description = data.description;
	this.options = data.options ?? [];
	this.test_string = data.test_string ?? "";
	this.hidden = data.hidden ?? false;
	this.execute = data.execute;
	this.onSuccess = data.onSuccess ?? null;
	this.regex = data.regex ?? null;
	this.log = data.log ?? false;
	this.points = data.points ?? 0;
	this.guild = data.guild ?? null;
	this.type = data.type;
	this.slash = true;
	this.admin = data.admin ?? false;
	this.ephemeral = data.ephemeral ?? (()=>{return false}); 
}
get slash_command() {
	if (this.type == "CHAT_INPUT"){
	return {
		name: this.name,
		description: this.description,
		options: this.options,
		type: this.type,
	} 
	} else {
	return {
		name: this.name,
		type: this.type
	}
	}
}
}

export default Command;