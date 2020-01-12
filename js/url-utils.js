module.exports = {
    getParameter: function (url, param) {
        var match = RegExp('[?&]' + param + '=([^&]*)').exec(url);
        return match && decodeURIComponent(match[1].replace(/\+/g, ' '));

    },

    getResource: function (url) {
        var indexLastSlash = url.lastIndexOf('/')
        var indexStartQs = url.indexOf('?')
        if (indexStartQs > 0) {
            return url.substring(indexLastSlash + 1, indexStartQs)
        } else {
            return url.substring(indexLastSlash + 1)
        }
    }
}
