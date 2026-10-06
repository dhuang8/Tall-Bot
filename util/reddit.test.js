import { jest } from '@jest/globals';
import config from './config.js';
import {
    checkRedditCredentials,
    fetchPostsThroughCursors,
    getRedditAccessToken,
    getUnseenPosts,
    listSubscribedSubreddits,
    normalizeSubreddit,
    pollRedditSubscriptions,
    subscribeToSubreddit,
    unsubscribeFromSubreddit
} from './reddit.js';

config.reddit.username = 'reddit_test_user';

function post(id, createdUtc, title = `post ${id}`, permalink = `/r/test/comments/${id}/post/`) {
    return {
        id,
        name: `t3_${id}`,
        title,
        permalink,
        created_utc: createdUtc
    };
}

function listing(posts, after = null) {
    return {
        ok: true,
        json: async () => ({
            data: {
                children: posts.map(data => ({ data })),
                after
            }
        })
    };
}

test('normalizes subreddit names and common Reddit links', () => {
    expect(normalizeSubreddit(' r/Some_Sub ')).toBe('some_sub');
    expect(normalizeSubreddit('https://www.reddit.com/r/Some_Sub/')).toBe('some_sub');
    expect(() => normalizeSubreddit('https://example.com/r/some_sub')).toThrow();
    expect(() => normalizeSubreddit('a')).toThrow();
});

test('fetches pages until the saved cursor is reached', async () => {
    const requestedAfter = [];
    const listingRequests = [];
    const fetchImpl = async (url, options) => {
        const parsed = new URL(url);
        listingRequests.push({ host: parsed.host, authorization: options.headers.Authorization });
        requestedAfter.push(parsed.searchParams.get('after'));
        if (!parsed.searchParams.has('after')) return listing([post('new', 30)], 'page-2');
        return listing([post('cursor', 20), post('old', 10)]);
    };
    const subscriptions = [{
        last_post_id: 't3_cursor',
        subscribed_at: 0
    }];

    const posts = await fetchPostsThroughCursors('test', subscriptions, fetchImpl, async () => 'test-token');

    expect(requestedAfter).toEqual([null, 'page-2']);
    expect(posts.map(item => item.id)).toEqual(['new', 'cursor', 'old']);
    expect(listingRequests).toEqual([
        { host: 'oauth.reddit.com', authorization: 'Bearer test-token' },
        { host: 'oauth.reddit.com', authorization: 'Bearer test-token' }
    ]);
});

test('requests and caches an app-only OAuth token', async () => {
    const oldRedditConfig = { ...config.reddit };
    config.reddit.client_id = 'test-client-id';
    config.reddit.client_secret = 'test-client-secret';
    const fetchImpl = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'test-token', expires_in: 3600 })
    });

    try {
        await expect(getRedditAccessToken(fetchImpl)).resolves.toBe('test-token');
        await expect(getRedditAccessToken(fetchImpl)).resolves.toBe('test-token');
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(fetchImpl.mock.calls[0][0]).toBe('https://www.reddit.com/api/v1/access_token');
        expect(fetchImpl.mock.calls[0][1].headers.Authorization).toMatch(/^Basic /);
        expect(fetchImpl.mock.calls[0][1].body.toString()).toBe('grant_type=client_credentials');
    } finally {
        Object.assign(config.reddit, oldRedditConfig);
    }
});

test('filters post history at the subscription cursor and orders oldest first', () => {
    const posts = [post('newest', 30), post('middle', 20), post('cursor', 10)];

    expect(getUnseenPosts(posts, {
        last_post_id: 't3_cursor',
        last_post_created_utc: 10
    }).map(item => item.id)).toEqual(['middle', 'newest']);
    expect(getUnseenPosts(posts, {
        last_post_id: null,
        subscribed_at: 15
    }).map(item => item.id)).toEqual(['middle', 'newest']);
});

test('persists each cursor only after its Discord delivery succeeds', async () => {
    const subscriptions = [{
        channel_id: 'channel-1',
        subreddit: 'test_',
        subscribed_at: 0,
        last_post_id: 't3_old',
        last_post_created_utc: 10
    }];
    const savedCursors = [];
    const sql = {
        prepare(query) {
            if (query.includes('SELECT channel_id')) return { all: () => subscriptions };
            return { run: (...values) => savedCursors.push(values) };
        }
    };
    const send = jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Discord unavailable'));
    const client = {
        channels: { fetch: async () => ({ isTextBased: () => true, send }) }
    };
    const fetchImpl = async () => listing([
        post('newest', 30, 'post newest', '/r/test_/comments/newest/post/'),
        post('middle', 20, 'Special Program Announcement', '/r/test_/comments/wwwwwww/special_program_announcement/'),
        post('old', 10, 'post old', '/r/test_/comments/old/post/')
    ]);
    const logError = jest.fn();

    await pollRedditSubscriptions(sql, client, fetchImpl, logError, async () => 'test-token');

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0].content).toContain(
        '[Special Program Announcement](https://www.vxreddit.com/r/test_/comments/wwwwwww/special_program_announcement/)'
    );
    expect(send.mock.calls[0][0].content).toContain('New post in r/test\\_:');
    expect(savedCursors).toEqual([['t3_middle', 20, 'channel-1', 'test_']]);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].components[0].toJSON().components[0].custom_id)
        .toBe('reddit|unsubscribe|test_');
});

test('subscription writes are idempotent and scoped to channel', () => {
    const rows = new Set();
    const sql = {
        prepare(query) {
            return {
                run(channelId, subreddit) {
                    const key = `${channelId}:${subreddit}`;
                    const hadRow = rows.has(key);
                    if (query.includes('INSERT')) rows.add(key);
                    else rows.delete(key);
                    return { changes: hadRow === query.includes('INSERT') ? 0 : 1 };
                }
            };
        }
    };

    expect(subscribeToSubreddit(sql, 'channel-1', 'gaming', 100)).toBe(true);
    expect(subscribeToSubreddit(sql, 'channel-1', 'gaming', 200)).toBe(false);
    expect(subscribeToSubreddit(sql, 'channel-2', 'gaming', 200)).toBe(true);
    expect(unsubscribeFromSubreddit(sql, 'channel-1', 'gaming')).toBe(true);
    expect(unsubscribeFromSubreddit(sql, 'channel-1', 'gaming')).toBe(false);
    expect(rows.has('channel-2:gaming')).toBe(true);
});

test('lists subscriptions for the requested channel only', () => {
    const sql = {
        prepare() {
            return { all: channelId => channelId === 'channel-1'
                ? [{ subreddit: 'games' }, { subreddit: 'news' }]
                : [] };
        }
    };

    expect(listSubscribedSubreddits(sql, 'channel-1')).toEqual(['games', 'news']);
    expect(listSubscribedSubreddits(sql, 'channel-2')).toEqual([]);
});

test('checks Reddit read access with a single authenticated listing request', async () => {
    const requests = [];
    const fetchImpl = async (url, options) => {
        requests.push({ url: new URL(url), authorization: options.headers.Authorization });
        return listing([post('one', 100)]);
    };

    await expect(checkRedditCredentials(fetchImpl, async () => 'test-token')).resolves.toEqual({
        subreddit: 'news',
        postsFound: 1
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].url.host).toBe('oauth.reddit.com');
    expect(requests[0].url.searchParams.get('limit')).toBe('1');
    expect(requests[0].authorization).toBe('Bearer test-token');
});