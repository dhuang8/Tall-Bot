import adb from "./adb.js";
import Util from '../util/functions.js';

test('adb 1 result', async () => {
    let response = await adb.execute(
        Util.createInteractionOptions(["crisis of identity"])
    );
    expect(response.title).toBe("Crisis of Identity");
});

test('adb no results', async () => {
    let response = await adb.execute(
        Util.createInteractionOptions(["asdf"])
    );
    expect(response).toBe("`No results`");
});

test('adb many results', async () => {
    let response = await adb.execute(
        Util.createInteractionOptions(["Roland"])
    );
    expect(response.footer.text).toBe("Respond with number");
});