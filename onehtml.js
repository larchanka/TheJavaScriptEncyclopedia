// onehtml.js
// 2015-09-26

// These Cyc rules produce a single HTML file.

/*jslint
    devel: true
*/

/*property
    $, aka, appendix, article, b, book, chapter, charCodeAt, create, end, es5,
    gen, i, level, link, name, program, replace, reserved, section, specimen,
    t, table, toLowerCase, toString, toUpperCase, url
*/

var rules = (function () {
    'use strict';
    var h_bit = false,
        link_text = Object.create(null),
        sx = /[!-@\[-\^`{-~]/g;     // special characters & digits


    function entityify(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }


    function special_encode(text) {

// Convert the text to lower case, and then replace ASCII special characters
// with pairs of hex digits. This makes special character sequences safe for
// use as filenames and urls. Alpha hex characters will be upper case.

        return text.toLowerCase().replace(sx, function (a) {
            return a.charCodeAt(0).toString(16).toUpperCase();
        });
    }

    function stuff_name(text, structure) {
        structure.name = text;
        link_text[structure.link] = text;
        return text;
    }

    function stuff_link(text, structure) {
        structure.link = text;
        return text;
    }

    function wrap(tag) {
        return function (text, structure) {
            return '<' + tag + ' id="' + structure.link + '">' +
                    text + '</' + tag + '>';
        };
    }

    function at_underbar(text) {
        text = h_bit
            ? "<th>" + text + "</th>"
            : "<td>" + text + "</td>";
        h_bit = false;
        return text;
    }


    return {
        '*': ['link', 'name', 'gen'],   // the names of the passes
        $: {                            // the naked text rule
            link: special_encode,
            name: entityify,
            gen: entityify
        },
        '': {                           // the default para rule
            link: '',
            name: '',
            gen: ["<p>", "</p>"]
        },
        aka: {
            link: '',
            name: '',
            gen: ["<dfn>", "</dfn>"]
        },
        appendix: 'chapter',
        article: {
            level: 4,
            link: stuff_link,
            name: stuff_name,
            gen: wrap("h3")
        },
        b: {
            gen: ["<b>", "</b>"]
        },
        book: {
            level: 1
        },
        chapter: {
            level: 2,
            link: stuff_link,
            name: stuff_name,
            gen: wrap("h1")
        },
        es5: {
            level: '',
            link: '',
            name: '',
            gen: ["<div class=es5>", "</div>"]
        },
        i: {
            gen: ["<i>", "</i>"]
        },
        link: {
            link: stuff_link,
            gen: function (ignore, structure) {
                if (link_text[structure.link]) {
                    return "<a href=\"#" + structure.link + "\">" +
                            link_text[structure.link] + "</a>";
                } else {
                    return structure.link + " <strong>MISSING LINK</strong>";
                }
            }
        },
        program: {
            level: true,
            name: '',
            link: '',
            gen: ["<pre>", "</pre>"]
        },
        reserved: {
            name: '',
            link: '',
            gen: "<a href=\"#reserved word\"><strong>reserved word</strong></a>"
        },
        section: {
            level: 5,
            link: '',
            name: '',
            gen: wrap("h4")
        },
        specimen: {
            level: 3,
            link: stuff_link,
            name: stuff_name,
            gen: wrap("h2")
        },
        t: {
            name: ["<tt>", "</tt>"],
            gen: ["<tt>", "</tt>"]
        },
        table: {
            level: true,
            link: '',
            name: '',
            gen: ["<table><tbody><tr>", "</tr></tbody></table>"],
            '@!': function (ignore) {
                h_bit = true;
            },
            '@_': at_underbar,
            '@|': function (text) {
                return at_underbar(text) + "</tr><tr>";
            },
            end: at_underbar
        },
        url: {
        }
    };
}());
