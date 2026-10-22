export const initializeHandlebars = () => {
    registerHandlebarsHelpers();
};

function registerHandlebarsHelpers() {
    Handlebars.registerHelper("removeMarkup", function (text) {
        const markup = /<(.*?)>/gi;
        return text.replace(markup, "");
    });

    Handlebars.registerHelper("config", function (key) {
        return game.deathwatch.config[key]
    })

    Handlebars.registerHelper("configLookup", function (obj, key) {
        return game.deathwatch.config[obj][key]
    })


    Handlebars.registerHelper("enrich", function (string) {
        return TextEditor.enrichHTML(string, { async: false })
    })


    Handlebars.registerHelper("array", function (array, cls) {
        if (typeof cls == "string")
            return array.map(i => `<a class="${cls}">${i}</a>`).join(`,`)
        else
            return array.join(", ")
    })

    Handlebars.registerHelper("substring", function (str, start, length) {
        return str ? str.substring(start, start + length) : ""
    })

    Handlebars.registerHelper("numberFormat", function (value, options) {
        const num = parseFloat(value);
        if (isNaN(num)) return value;

        const decimals = options.hash.decimals !== undefined ? options.hash.decimals : 0;
        const sign = options.hash.sign || false;

        const formatted = num.toFixed(decimals);

        if (sign && num > 0) {
            return `+${formatted}`;
        }
        return formatted;
    })

    Handlebars.registerHelper("subtract", function (a, b) {
        return a - b;
    })

    Handlebars.registerHelper("hasKeys", function (obj) {
        return obj && typeof obj === 'object' && Object.keys(obj).length > 0;
    })

    Handlebars.registerHelper("movementValue", function (value) {
        if (typeof value === 'string') return value;
        return `${value}m`;
    })

    Handlebars.registerHelper("eq", function (a, b) {
        return a === b;
    })

    Handlebars.registerHelper("qualityList", function (qualities) {
        if (!Array.isArray(qualities) || qualities.length === 0) return "";
        return qualities.map(q => {
            if (typeof q === 'object' && q !== null) {
                const key = q.id || q._id || q.key || "";
                const name = key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                return q.value ? `${name} (${q.value})` : name;
            }
            return String(q).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        }).filter(Boolean).join(", ");
    })
}
