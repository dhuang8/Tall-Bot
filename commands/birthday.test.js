import birthday from "./birthday.js";
import Util from '../util/functions.js';

test('birthday set', async () => {
    let opt = Util.createInteractionOptions(["set", "1990"],"1234567890");
    opt.options.data[0].options[1] = {value: 1};
    opt.options.data[0].options[2] = {value: 20};
    let response = await birthday.execute(opt);
    expect(response).toBe("`Birthday set to February 20, 1990`");
});


test('birthday get', async () => {
    let opt = Util.createInteractionOptions(["get"]);
    opt.options.data[0].options = [{user: {id: "1234567890"}}];
    let response = await birthday.execute(opt);
    expect(response).toMatch(/.+ turns .+ in .+ on February 20/);
});