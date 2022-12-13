import birthday from "./birthday2.js";
import Util from '../util/functions.js';

test('birthday2 get', async () => {
    let interaction = Util.createInteractionOptions(["getbirthday"]);
    interaction.options.data[0].user = {id: "1234567890"};
    let response = await birthday.execute(interaction);
    expect(response).toMatch(/.+ turns .+ in .+ on February 20/);
});