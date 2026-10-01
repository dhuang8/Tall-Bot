import { CronJob } from 'cron';
import sql from '../util/SQLite.js';
import { pollRedditSubscriptions } from '../util/reddit.js';

export default class RedditSchedule {
    constructor(client) {
        this.client = client;
        this.running = false;
        this.job = new CronJob('0 0 * * * *', () => this.run(), null, false, 'UTC');
        const start = () => {
            this.job.start();
            void this.run();
        };
        if (client.isReady()) start();
        else client.once('ready', start);
    }

    async run() {
        if (this.running) return;
        this.running = true;
        try {
            await pollRedditSubscriptions(sql, this.client);
        } catch (error) {
            console.error('Reddit polling failed', error);
        } finally {
            this.running = false;
        }
    }
}