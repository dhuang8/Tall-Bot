import define from "./define.js";
import Util from '../util/functions.js';

test('define', async () => {
    let response = await define.execute(Util.createInteractionOptions(
        ["diet"]
    ));
    expect(response.title).toBe("diet");
});