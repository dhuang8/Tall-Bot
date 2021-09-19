f = {
    escapeMarkdownText: function(str, noemotes = true) {
        if (noemotes) {
            return str.replace(/([\\\(\)*_~<>`])/g, '\\\$1')
        } else {
            return str.replace(/([\\\(\)*_~`])/g, '\\\$1')
        }
    },

    

    escapeMarkdownText: function(str, noemotes = true) {
        if (noemotes) {
            return str.replace(/([\\\(\)*_~<>`|])/g, '\\\$1')
        } else {
            return str.replace(/([\\\(\)*_~`])/g, '\\\$1')
        }
    },

    replaceAll: function(str, find, replace) {
        return str.replace(new RegExp(find, 'g'), replace);
    },

    htmldecode: function(a) {
        a = f.replaceAll(a, "&#39;", "'")
        a = f.replaceAll(a, "&amp;", "&")
        a = f.replaceAll(a, "&gt;", ">")
        a = f.replaceAll(a, "&lt;", "<")
        a = f.replaceAll(a, "&quote;", '"')
        a = f.replaceAll(a, "&apos;", "'")
        return a;
    },
}
module.exports = f;