import hs from "./hs.js";
import Util from '../util/functions.js';

test('hs get', async () => {
    let interaction = Util.createInteractionOptions(["Bronzebeard"]);
    interaction.options.data[1] = {value: "battlegrounds"};
    let embed = await hs.execute(interaction);
    expect(embed.title).toBe('Brann Bronzebeard');
});