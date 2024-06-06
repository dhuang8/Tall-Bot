import {Alarm} from "./alarm.js";
import sql from '../util/SQLite.js';

test('new alarm', async () => {
    const alarm = new Alarm(null, "alarm name2");
    console.log("id", alarm.id, "name", alarm.name);
});