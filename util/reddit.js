import { escapeMarkdown } from '@discordjs/formatters';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import config from '../config.json' with { type: 'json' };

let cachedAccessToken;
let accessTokenExpiresAt = 0;
let cachedCredentialKey;

function redditUserAgent() {
    const username = config.reddit?.username?.replace(/^u\//i, '');
    if (!username) throw new Error('Set reddit.username in config.json for the Reddit Data API User-Agent.');
    return `discord:TallBot:v14.0 (by /u/${username})`;
}

export async function getRedditAccessToken(fetchImpl = fetch) {
    const clientId = config.reddit?.client_id;
    const clientSecret = config.reddit?.client_secret;
    if (!clientId || !clientSecret) {
        throw new Error('Set reddit.client_id and reddit.client_secret in config.json to authenticate with Reddit.');
    }

    const userAgent = redditUserAgent();
    const credentialKey = `${clientId}:${clientSecret}`;
    if (cachedAccessToken && cachedCredentialKey === credentialKey && accessTokenExpiresAt > Date.now() + 60_000) {
        return cachedAccessToken;
    }

    const response = await fetchImpl('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
            Authorization: `Basic ${Buffer.from(credentialKey).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': userAgent
        },
        body: new URLSearchParams({ grant_type: 'client_credentials' })
    });
    if (!response.ok) {
        throw new Error(`Reddit OAuth token request returned HTTP ${response.status}; check the app credentials and Data API access.`);
    }

    const token = await response.json();
    if (typeof token.access_token !== 'string' || !Number.isFinite(Number(token.expires_in))) {
        throw new Error('Reddit returned an invalid OAuth token response.');
    }
    cachedAccessToken = token.access_token;
    cachedCredentialKey = credentialKey;
    accessTokenExpiresAt = Date.now() + Number(token.expires_in) * 1000;
    return cachedAccessToken;
}

export function normalizeSubreddit(input) {
    if (typeof input !== 'string') throw new Error('Enter a subreddit name.');

    let subreddit = input.trim()
        .replace(/^https?:\/\/(?:www\.)?reddit\.com\/r\//i, '')
        .replace(/^\/?r\//i, '')
        .replace(/\/$/, '');

    if (!/^[a-z0-9_]{2,21}$/i.test(subreddit)) {
        throw new Error('Enter a subreddit name, such as `r/gaming`.');
    }
    return subreddit.toLowerCase();
}

export function subscribeToSubreddit(sql, channelId, subreddit, subscribedAt = Math.floor(Date.now() / 1000)) {
    const result = sql.prepare(`
        INSERT OR IGNORE INTO reddit_subscriptions
            (channel_id, subreddit, subscribed_at)
        VALUES (?, ?, ?)
    `).run(channelId, subreddit, subscribedAt);
    return result.changes > 0;
}

export function unsubscribeFromSubreddit(sql, channelId, subreddit) {
    const result = sql.prepare(`
        DELETE FROM reddit_subscriptions
        WHERE channel_id = ? AND subreddit = ?
    `).run(channelId, subreddit);
    return result.changes > 0;
}

export function listSubscribedSubreddits(sql, channelId) {
    return sql.prepare(`
        SELECT subreddit FROM reddit_subscriptions
        WHERE channel_id = ?
        ORDER BY subreddit
    `).all(channelId).map(row => row.subreddit);
}

function parsePosts(children) {
    return children.map(({ data }) => data).filter(post => {
        return post && typeof post.id === 'string' && typeof post.title === 'string'
            && typeof post.permalink === 'string' && Number.isFinite(Number(post.created_utc));
    }).map(post => ({
        id: post.id,
        name: post.name ?? `t3_${post.id}`,
        title: post.title,
        permalink: post.permalink,
        created_utc: Number(post.created_utc)
    }));
}

async function fetchRedditJson(url, accessToken, fetchImpl) {
    const response = await fetchImpl(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': redditUserAgent()
        }
    });
    if (!response.ok) {
        const accessHelp = response.status === 401 || response.status === 403
            ? '; check the OAuth app credentials and Data API access'
            : '';
        throw new Error(`Reddit Data API returned HTTP ${response.status}${accessHelp}.`);
    }
    return response.json();
}

export async function checkRedditCredentials(fetchImpl = fetch, tokenProvider = getRedditAccessToken) {
    const accessToken = await tokenProvider(fetchImpl);
    const url = new URL('https://oauth.reddit.com/r/news/new');
    url.searchParams.set('limit', '1');
    url.searchParams.set('raw_json', '1');

    const listing = await fetchRedditJson(url, accessToken, fetchImpl);
    if (!Array.isArray(listing?.data?.children)) {
        throw new Error('Reddit returned an invalid post listing.');
    }
    return { subreddit: 'news', postsFound: listing.data.children.length };
}

export async function fetchPostsThroughCursors(subreddit, subscriptions, fetchImpl = fetch, tokenProvider = getRedditAccessToken) {
    const posts = [];
    const reached = new Set();
    let after = null;
    const accessToken = await tokenProvider(fetchImpl);
    const userAgent = redditUserAgent();

    while (reached.size < subscriptions.length) {
        const url = new URL(`https://oauth.reddit.com/r/${encodeURIComponent(subreddit)}/new`);
        url.searchParams.set('limit', '100');
        url.searchParams.set('raw_json', '1');
        if (after) url.searchParams.set('after', after);

        const listing = await fetchRedditJson(url, accessToken, fetchImpl);
        if (!Array.isArray(listing?.data?.children)) {
            throw new Error('Reddit returned an invalid post listing.');
        }
        const pagePosts = parsePosts(listing.data.children);
        posts.push(...pagePosts);

        subscriptions.forEach((subscription, index) => {
            if (reached.has(index)) return;
            if (subscription.last_post_id) {
                if (pagePosts.some(post => post.name === subscription.last_post_id)) reached.add(index);
            } else if (pagePosts.some(post => post.created_utc <= Number(subscription.subscribed_at))) {
                reached.add(index);
            }
        });

        const nextAfter = listing.data.after;
        if (!nextAfter || nextAfter === after || pagePosts.length === 0) break;
        after = nextAfter;
    }

    return posts;
}

export function getUnseenPosts(posts, subscription) {
    let unseen;
    if (subscription.last_post_id) {
        const cursorIndex = posts.findIndex(post => post.name === subscription.last_post_id);
        if (cursorIndex >= 0) {
            unseen = posts.slice(0, cursorIndex);
        } else if (Number.isFinite(Number(subscription.last_post_created_utc))) {
            unseen = posts.filter(post => post.created_utc > Number(subscription.last_post_created_utc));
        } else {
            unseen = [];
        }
    } else {
        unseen = posts.filter(post => post.created_utc > Number(subscription.subscribed_at));
    }

    return unseen.sort((a, b) => a.created_utc - b.created_utc || a.name.localeCompare(b.name));
}

function saveCursor(sql, subscription, post) {
    sql.prepare(`
        UPDATE reddit_subscriptions
        SET last_post_id = ?, last_post_created_utc = ?
        WHERE channel_id = ? AND subreddit = ?
    `).run(post.name, post.created_utc, subscription.channel_id, subscription.subreddit);
}

export async function pollRedditSubscriptions(sql, client, fetchImpl = fetch, logError = console.error, tokenProvider = getRedditAccessToken) {
    const subscriptions = sql.prepare(`
        SELECT channel_id, subreddit, subscribed_at, last_post_id, last_post_created_utc
        FROM reddit_subscriptions
        ORDER BY subreddit, channel_id
    `).all();
    const bySubreddit = new Map();
    subscriptions.forEach(subscription => {
        const group = bySubreddit.get(subscription.subreddit) ?? [];
        group.push(subscription);
        bySubreddit.set(subscription.subreddit, group);
    });

    for (const [subreddit, group] of bySubreddit) {
        let posts;
        try {
            posts = await fetchPostsThroughCursors(subreddit, group, fetchImpl, tokenProvider);
        } catch (error) {
            logError(`Could not fetch r/${subreddit}`, error);
            continue;
        }

        for (const subscription of group) {
            const unseen = getUnseenPosts(posts, subscription);
            if (unseen.length === 0) {
                if (!subscription.last_post_id && posts.length > 0) {
                    saveCursor(sql, subscription, posts[0]);
                }
                continue;
            }

            let channel;
            try {
                channel = await client.channels.fetch(subscription.channel_id);
                if (!channel?.isTextBased()) throw new Error('Subscribed channel is not text-based.');
            } catch (error) {
                logError(`Could not access Reddit subscription channel ${subscription.channel_id}`, error);
                continue;
            }

            for (const post of unseen) {
                const url = `https://www.vxreddit.com${post.permalink}`;
                const unsubscribeButton = new ButtonBuilder()
                    .setCustomId(`reddit|unsubscribe|${subreddit}`)
                    .setLabel(`Unsubscribe from r/${subreddit}`)
                    .setStyle(ButtonStyle.Secondary);
                const row = new ActionRowBuilder().addComponents(unsubscribeButton);
                try {
                    await channel.send({
                        content: `New post in r/${escapeMarkdown(subreddit)}: [${escapeMarkdown(post.title)}](${url})`,
                        allowedMentions: { parse: [] },
                        components: [row]
                    });
                    saveCursor(sql, subscription, post);
                } catch (error) {
                    logError(`Could not deliver Reddit post ${post.name} to ${subscription.channel_id}`, error);
                    break;
                }
            }
        }
    }
}