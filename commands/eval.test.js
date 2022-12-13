import evalCommand from "./eval.js";
import Util from '../util/functions.js';

test('eval 1+1', async () => {
    let response = await evalCommand.execute(Util.createInteractionOptions(
        ["1+1"]
    ));
    expect(response).toBe(2);
});