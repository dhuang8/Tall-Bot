const xLinkPattern = /\bhttps?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^\s<>]+/gi;

export function getFixupXLinks(content) {
    return [...content.matchAll(xLinkPattern)].flatMap(([match]) => {
        const candidate = match.replace(/[.,!?;:)\]]+$/, "");
        let url;
        try {
            url = new URL(candidate);
        } catch {
            return [];
        }

        if (!/^(?:www\.)?(?:x\.com|twitter\.com)$/i.test(url.hostname)) return [];
        if (!/\/status\/\d+(?:\/|$)/i.test(url.pathname)) return [];

        url.hostname = "fixupx.com";
        return [url.toString()];
    });
}