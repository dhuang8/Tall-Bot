import mtg from "./mtg.js";
import {createInteractionOptions} from '../util/functions.js';

test('mtg saheeli', async () => {
    let response = await mtg.execute(createInteractionOptions(
        ["saheeli"]
    ));
    expect(response.title).toBe('Multiple cards found');
    response = await mtg.execute(createInteractionOptions(
        ["Saheeli's Directive"]
    ));
    expect(response.title).toBe("Saheeli's Directive");
    expect(response.url).toBe("https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=450627");
});