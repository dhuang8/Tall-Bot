export function crossIfTrue(test, string) {
    if (test) return `~~${string}~~`;
    return string
}

export function calcTimestampAfter(time) {
    return parseInt(new Date(Date.now()+time*1000).getTime()/1000)
}
