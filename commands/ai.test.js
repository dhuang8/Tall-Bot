import ai from "./ai.js";
import Util from '../util/functions.js';

test('ai test', async () => {
    let response = await ai.execute(
        //Util.createInteractionOptions(["Answer with the 4th planet from the Sun."])
        Util.createInteractionOptions(["unique Dog name"])
    );
    console.log(response)
});