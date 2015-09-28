// include.js
// 2015-09-26


function include(callback, text, get_inclusion, get_directory) {

// The include function replaces @include expressions with stuff.

    'use strict';

    function back(err, data) {

// We use the back function to call the callback. This indirection is to
// ensure that the callback is only called once.

        var call = callback;
        callback = null;
        return call(err, data);
    }

// The include processor takes these parameters:

//      callback(err, data):
//                  This function is given the result in this turn or a future
//                  turn.
//      text: A string that may have embedded zero or more of
//                      @include "key"
//                  or
//                      @include directory "key"
//                  or
//                      @include directory /pattern/ "key"
//                  or
//                      @include directory .ext "key"
//                  or
//                      @include directory /pattern/ .ext "key"
//
//                  Replace each with the inclusion associated with the key.
//                  A key can be wrapped in any of these six pairs:
//                      " "     ' '     < >     ( )     [ ]     { }
//                  The @include directory form includes all of the files from
//                  the named directory.
//                  If a regular expression is provided, then only files whose
//                  names are matched will be included.
//                  If an extension is provided, only files having that
//                  extension will be included.
//      get_inclusion(callback, key, quote):
//                  This function will take a key string and give the resulting
//                  inclusion string to callback(err, data). The function could
//                  be implemented by accessing a file system, database, source
//                  control system, content manager, or JSON Object. It may
//                  also take an initial quote character that shows how the key
//                  was wrapped. This makes it possible to treat '"' differently
//                  from '<'.
//      get_directory(callback, key, quote):
//                  This function will take a key string and give an array
//                  of keystrings that can be used to access files from the
//                  directory.
// Nothing is returned. The result is communicated through the callback.

// If inclusions are coming from files, and if the environment is nodejs, then
// get_inclusion and get_directory could be defined like this:

// var fs = require('fs');

// function get_inclusion(callback, key, quote) {
//     fs.readFile(key, 'utf8', callback);
// }
//
// function get_directory(callback, path, quote) {
//     fs.readdir(path, callback);
// }


    var directory = 'directory',
        head = 0,   // head marks the beginning of the '@include' substring.
                    // head is kept in the outer scope so indexOf does not
                    // need to ever rescan material that previously didn't
                    // match.
        at_include = '@include',
        pair = {    // We allow the key to be wrapped by any of these pairs.
            '"': '"',
            '\'': '\'',
            '<': '>',
            '(': ')',
            '[': ']',
            '{': '}'
        },
        regexp = /^\/((?:\[(?:[^\\\]]|\\[^\r\n])*\]|\\[^\r\n]|[^\\\[\r\n])*)\//,
        seen = {},  // seen notices if a key has already been included.
                    // Any file key will be acted on only once.
        slash = '/';



    function helper(text) {

// The helper function does include's work. It will call itself until all of
// the @include specifications have been replaced.

        var c,      // a character
            close,  // a close quote
            count,  // the number of excess @ prefixes
            dir = false,
            ext = '',
            exuc,   // the result of .exec
            fore,   // the position before the head of excess @ prefixes
            key,
            middle, // middle will eventually mark the beginning of the key
            open,   // an open quote
            pattern,
            tail;   // tail will mark the remainder of the text.

        function skip(s) {
            while (text.charAt(middle) === s) {
                middle += 1;
            }
        }


// The function body is wrapped in a try so the callback can be called if
// there is an unexpected failure.

        try {

// Search for the next occurrence of '@include'. If it isn't found, then there
// is no more work to do. Simply give the original text to the callback. This
// is the successful conclusion of include.

            while (true) {
                head = text.indexOf(at_include, head);
                if (head < 0) {
                    return back(null, text);
                }
                fore = head;
                count = 0;

// If the '@include' was preceeded by an odd number of '@', then ignore it.

                while (true) {
                    fore -= 1;
                    if (fore < 0 || text.charAt(fore) !== '@') {
                        break;
                    }
                    count += 1;
                }
                if (Math.floor(count / 2) === 0) {
                    break;
                }
                head += at_include.length;
            }


// The middle index points to the character position immediately after the
// '@include'. If it is an optional space, skip over it.

            middle = head + at_include.length;
            skip(' ');

// The next part might be 'directory'.

            if (text.substr(middle, directory.length) === directory) {
                dir = true;
                middle += directory.length;
                skip(' ');

// @include directory may optionally specify a regular expression or extension
// that will be used to filter the directory.

// If there is a regular expression, then attempt to match it. If it matches,
// compile it to be used later in pattern matching.

                if (text.charAt(middle) === '/') {
                    exuc = regexp.exec(text.slice(middle));
                    if (!exuc) {
                        return back(new Error("Bad /regexp/ at " + middle +
                                ": " + text));
                    }
                    pattern = new RegExp(exuc[1]);
                    middle += exuc[0].length;
                    skip(' ');
                }
                if (text.charAt(middle) === '.') {

// If there is an extension, fill the extension with character up to but not
// including the next whitespace or open quote.

                    skip('.');
                    while (true) {
                        c = text.charAt(middle);
                        if (c <= ' ' || pair[c]) {
                            break;
                        }
                        ext += c;
                        middle += 1;
                    }
                    if (!ext) {
                        return back(new Error("Missing .ext at " + middle +
                                ": " + text));
                    }
                }
                skip(' ');
            }

// The next character must be a quote. If it is not a quote, give the error to
// the callback.

            open = text.charAt(middle);
            close = pair[open];
            if (typeof close !== 'string') {
                return back(new Error("Missing quote at " + middle +
                        ": " + text));
            }

// Search for the close quote. If it isn't there, give an error to the callback.

            tail = text.indexOf(close, middle + 1);
            if (tail < 0) {
                return back(new Error("Missing '" + close + "' after " +
                        middle + ": " + text));
            }
            key = text.slice(middle + 1, tail);

// Process the @include directory.

            if (dir) {
                return get_directory(key, function (err, files) {

// This is the callback that gets called by get_directory.

                    if (err) {
                        return back(err);
                    }
                    var length = 0,
                        inclusion = [text.slice(0, head)];

// If there was a file extension or a regular expression, then filter the
// array of filenames.

                    if (ext) {
                        files = files.filter(function (value) {
                            return value.charAt((value.length - 1) -
                                    ext.length) === '.' &&
                                    value.slice(value.length - ext.length) === ext;
                        });
                    }
                    if (pattern) {
                        files = files.filter(function (value) {
                            return pattern.test(value);
                        });
                    }

// Filter out names we have already included.

                    files = files.filter(function (value) {
                        var name = key + slash + value;
                        if (seen[name] === true) {
                            return false;
                        } else {
                            seen[name] = true;
                            return true;
                        }
                    });
                    files.sort();

// We have a sorted array of filenames. Read them all into the inclusion array.

                    length = files.length;
                    if (length > 0) {
                        files.forEach(function (value, index) {
                            get_inclusion(key + slash + value, function (err, data) {

// This is the function that is called as each inclusion is read.

                                if (err) {
                                    return back(err);
                                }

// We put each file into its slot in the inclusion array. If this was the last
// inclusion, then join it all up and pass it to the helper. The inclusion
// array contains all of the inclusion material plus the head and tail pieces
// of the text.

                                inclusion[index + 1] = data;
                                length -= 1;
                                if (length === 0) {
                                    inclusion.push(text.slice(tail + 1));
                                    return helper(inclusion.join(''));
                                }
                            });
                        });
                    } else {

// If the directory contained no unseen files, then give a warning.

                        return back(new Error("Nothing included from " + key));
                    }
                }, open);
            } else {

// Process the @include. Read the file, providing another callback function.

// If the key (or filename) has already been encountered, then delete the
// @include expression and pass the shortened text to helper again. This is to
// avoid infinite recurrence. Any key can only be included once.

                if (seen[key] === true) {
                    return helper(text.slice(0, head) + text.slice(tail + 1));
                }
                seen[key] = true;
                return get_inclusion(key, function (err, data) {

// This is the callback function that is passed to get_inclusion.
// If the get failed for any reason, pass the error to the original callback.

                    if (err) {
                        return back(err);
                    }

// If the get succeeded, insert the file's contents into the text. Then, to
// process any additional includes, pass the new text recursively to helper.

                    return helper(text.slice(0, head) + data + text.slice(tail + 1));
                });
            }
        } catch (exception) {
            return back(exception);
        }
    }
    return helper(text);
}


