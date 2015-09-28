// cyc.js
// 2015-09-26

/*jslint devel: true */


var cyc = (function () {
    'use strict';

    var pair = {
            '(': ')',
            '[': ']',
            '{': '}',
            '<': '>',
            '"': '"',
            '\'': '\'',
            '`': '`',
            '@': '@'
        },
        lx = /\n|\r\n?/g,                           // line end
        tx = /@[*#@_!\|]?|["'{}()<>\[\]]|[^@"'{}()<>\[\]]+/g;  // text or some special


    function error(message) {
        alert(message);
        debugger;
        throw message;
    }


    function parse(text, rules) {

// We take a cyclopede text and produce this structure:
// An array of forms (@speciment, @article).
// A form contains an array of lines. The first element is the name of the form.
// A line contains an array of strings and forms.
// Other functions will consume this structure.
// The set of rules is used to make sure that the tags have meaningful names.

        var closer,
            line_nr = 0,
            lines = [],
            name,
            part_nr = 0,
            stack = [],
            structure,
            temp,
            token,
            top;

        function deposit(thing) {

// The deposit function takes a thing and adds it to the structure.
// The structure is an array of lines, where a line is an array of things.
// A thing may be a string or an array that represents a nested structure.
// If consecutive things are strings, it will attempt to combine them
// into a single string.

            var line;

// If the thing is an empty string, then we are at the end of a line.
// Push an empty line into the structure.

            if (thing === '') {
                structure.push([]);

// If the new thing is a string, and if the last thing on the current row is
// a string, then combine them.

            } else {
                line = structure[structure.length - 1];
                if (line.length && typeof thing === 'string' &&
                        typeof line[line.length - 1] === 'string') {
                    line[line.length - 1] += thing;

// Otherwise, push the thing, whatever it is, onto the line.

                } else {
                    line.push(thing);
                }
            }
        }


        function next_token() {

// Return the next token from lines: an array of arrays of strings.
// We retain some line endings in case they are significant:
// After the last token of a row, the token will be an empty string.
// If there are no more rows, the token will be null.

            if (part_nr >= lines[line_nr].length) {
                part_nr = 0;
                line_nr += 1;
                return line_nr >= lines.length
                    ? null
                    : '';
            } else {
                var next = lines[line_nr][part_nr];
                part_nr += 1;
                return next;
            }
        }


// Start by busting the text into lines and then into tokens. A token is one of
//      @  '  "  (  )  [  ]  {  }  <  >
//      @|  @_  @!
// or a string containing none of those.

        lines = text.split(lx).map(function (value) {
            return value.match(tx) || '';
        });

// The outermost structure has no name.

        structure = ['', []];

// As we go through the tokens, we combine tokens into strings, strings into
// lines, and lines into structures.

        while (true) {
            token = next_token();
            switch (token) {
            case '@@':
                deposit('@');
                break;

// If we see @, it will be @ name ( content ).

            case '@':
                token = next_token();
                name = token.trim();

// If the rule for this name is a string, then it is an alias.

                if (typeof rules[name] === 'string') {
                    name = rules[name];
                }

// If there is a rule for this name, then get the next token, which should be
// an opener. Find its closer. Push the current structure and the closer on the
// stack. Make a new structure with the name as the first element.

                if (name === 'begin' || name === 'end' ||
                        typeof rules[name] === 'object') {
                    token = next_token();
                    closer = pair[token];
                    if (typeof closer !== 'string') {
                        return error("Bad opener " + token);
                    }
                    if (closer === '@') {
                        deposit([name]);
                    } else {
                        stack.push(structure, closer);
                        structure = [name, []];
                    }
                } else {

// If there is not a rule for this name, then there is an error.

                    return error("Not a name: " + name);
                }
                break;

// null means we have reached the end of tokens. The stack had better be empty.

            case null:
                if (stack.length > 0) {
                    top = stack[stack.length - 1];
                    return error(typeof top === 'string'
                        ? "Missing " + top + " to close @" + structure[0]
                        : "Missing @end(" + structure[0] + ")");
                }
                return structure;

// If the token matches the closer at the top of stack, then we have
// completed a structure. If it was a begin or end, do some special
// processing.

            case stack[stack.length - 1]:
                stack.pop();
                switch (structure[0]) {

// @begin(name) causes a new structure with that name to be made.
// The begin structure is replaced with a new structure.

                case 'begin':
                    if (structure.length !== 2 || structure[1].length !== 1) {
                        return error('bad begin');
                    }
                    name = structure[1][0].trim();
                    if (typeof rules[name] === 'string') {
                        name = rules[name];
                    }
                    if (typeof rules[name] !== 'object') {
                        return error('bad @begin(' + name + ')');
                    }
                    if (stack.length > 1 && typeof rules[name].level === 'number') {
                        return error("Misplaced @begin(" + structure[1][0].trim() + ")");
                    }
                    structure = [name, []];
                    break;
                case 'end':
                    if (structure.length !== 2 || structure[1].length !== 1) {
                        return error('bad end');
                    }
                    name = structure[1][0].trim();
                    temp = stack.pop();
                    if (!temp || !temp[0]) {
                        return error("Unexpected @end(" + name + ")");
                    }
                    if (name === temp[0]) {
                        structure = stack.pop();
                        deposit(temp);
                        break;
                    } else {
                        return error(typeof stack[stack.length - 1] === 'string'
                            ? "Expected " + stack[stack.length - 1] +
                                    " to close @" + temp[0] +
                                    " and instead  saw @end(" + name + ")"
                            : "Expected @end(" + temp[0] +
                                    ") and instead saw @end(" + name + ")");
                    }
                default:
                    temp = structure;
                    structure = stack.pop();
                    deposit(temp);
                    if (stack.length && typeof rules[temp[0]].level === 'number') {
                        return error("Misplaced @" + temp[0]);
                    }
                }
                break;
            default:
                deposit(token);
            }
        }
    }

    return function cyclopede(text, rules) {

// The cyclopede function takes a set of rules and a text and returns a
// transformation. The transformation is determined by the rules. Ultimately,
// each of the methods of the rules will be passed a toolkit that will help
// them to do their work.

// The rules are specified as an object. The names correspond to tags, and the
// values contain properties and methods that are used for processing the tag.
// A rule can also be a string, which is an alias of another rule.

// The rule named '*' is an array of pass names, such as 'prep' or 'gen'.

// The rule named '' represents the outermost structure. It will always be the
// first rule to be applied.

// The rule named '$' is an object containing methods for transforming raw text.

// There is a rule for each @name, containing an object with a method for each
// pass, and possibly a level.

        var course,         // The current meta nesting.
            course_level,   // The associated level numbering.
            pass,           // The current pass from rules['*'].
            stack,          // The current nesting.
            structure = parse(text, rules);


        function apply(name, text, structure) {
            var rule = rules[name][pass];

// Clean any trailing newlines from the text.

            while (text.slice(-1) === '\n') {
                text = text.slice(0, -1);
            }

// If the rule yields a function, then that function gets the currect
// piece of structure, and the result of processing the structure's children.
// If the rule yields a string, then that string is used as the value.

            return typeof rule === 'function'
                ? rule(text, structure)
                : typeof rule === 'string'
                    ? rule
                    : Array.isArray(rule)
                        ? (rule[0] || '') + text + (rule[1] || '')
                        : text;
        }


        function uncourse(level) {

// Close out lower level courses. A course can optionally provide a _close
// method that will receive the text of that course, which it can modify
// or replace.

            var closer, result = '';
            while (course_level.length > 0 &&
                    course_level[course_level.length - 1] >= level) {
                closer = rules[course.pop()][pass + '_close'];
                course_level.pop();
                if (typeof closer === 'function') {
                    result = closer(result);
                } else if (typeof closer === 'string') {
                    result = closer;
                }
            }
            return result;
        }


        function process(structure) {

// The process function takes a structure. It will walk through the structure.

            var actual,
                level,
                name = structure[0],
                para_result = '',
                result = '';

            level = rules[name].level;
            stack.push(name);
            if (typeof level === 'string') {

// A rule can be an alias, so that it acts like another rule.

                actual = name;
                name = level;
                level = rules[name].level;
            }

// If the rule is a level number, then update the course and course_level.
// Encountering a low numbered level will cause higher levels to be dropped.

            if (typeof level === 'number') {
                if (!name) {
                    para_result += apply('', '', structure);
                }
                para_result += uncourse(level);
                course.push(name);
                course_level.push(level);
            }
            if (typeof rules[name].begin === 'function') {
                para_result = rules[name].begin('');
            }

// Walk through the structure visiting all of the things in it. Things that are
// strings will be transformed by the $ rule. This is where entityification
// will occur for HTML. If the thing is another structure, push the name of
// the current structure, and process the nested thing.

            structure.slice(1).forEach(function (row) {

// If the row is empty, then if we are in a para situation, then act on it.

                if (row.length === 0) {
                    if (!name && result) {
                        para_result += apply('', result, structure);
                        result = '';
                    }

// Scan through the row. If a string is found, use the $ rule to encode it.

                } else {
                    row.forEach(function (thing) {
                        if (typeof thing === 'string') {
                            if (thing.length === 2 && thing.charAt(0) === '@') {
                                if (typeof rules[name][thing] === 'function') {
                                    thing = rules[name][thing](result);
                                    if (typeof thing === 'string') {
                                        para_result += thing;
                                        result = '';
                                    }
                                    thing = '';
                                }
                            } else {
                                thing = apply('$', thing, structure);
                            }

// Otherwise, process the thing. If the thing has a level, and if this is an
// unnamed level, then first accumulate another paragraph.

                        } else {
                            if (!name && rules[thing[0]].level !== undefined) {
                                if (result) {
                                    para_result += apply('', result, structure);
                                    result = '';
                                }
                                para_result += process(thing);
                                thing = '';
                            } else {
                                thing = process(thing);
                            }
                        }
                        result += thing;
                    });
                }

// At the end of the row, tack on a newline.

                if (result) {
                    result += '\n';
                }
            });
            if (typeof rules[name].end === 'function') {
                result = para_result + rules[name].end(result);
                para_result = '';
            }
            result = para_result + apply(name, result, structure);

// The result is returned, which may first be transformed or replaced by the
// rule.

            stack.pop();
            if (stack.length === 0) {
                result += uncourse(0);
            }
            if (typeof actual === 'string') {
                result = apply(actual, result, structure);
            }
            return result;
        }


        return rules['*'].map(function (which) {
            pass = which;
            course = [];
            course_level = [];
            stack = [];
            return process(structure);
        }).pop();
    };
}());
