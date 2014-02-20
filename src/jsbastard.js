/**
 * Wish list:
 * [ ] `var` must be the first instruction in the function
 *     -> because otherwise we may mistakenly declare them in a for loop
 * [ ] every script must be wrapped in a closure
 *     -> to avoid name clashes
 * [ ] stuff must be documented
 *     -> obvious ?
 * [ ] `var` initialization cannot take more than one line
 *     -> makes the code unreadable
 * [ ] No function definition in a `var`
 *     -> makes the code unreadable
 * [ ] There must be no jslint option
 *     -> you're cheating !
 */
(function () {
    "use strict";

    var esprima = require('esprima'),
        fs = require('fs'),
        util = require('util'),
        main,
        Bastard,
        Script,
        Closure,
        Body,
        Comments,
        ForStatement,
        VariableDeclaration,
        Declaration,
        FunctionDeclaration;

    Bastard = function (options) {
        this.options = {
            'encoding': 'utf8'
        };
    };
    Bastard.prototype = {
        lint: function (filename, callback) {
            this.withJavascriptFile(filename, function (ast) {
                new Script(ast).lint(function (complaint) {
                    complaint.filename = filename;
                    callback(complaint);
                });
            });
        },
        withJavascriptFile: function (filename, callback) {
            fs.readFile(filename, this.options.encoding, function (err, data) {
                if (!err) {
                    callback(esprima.parse(data, {
                        comment: true,
                        loc: true
                    }));
                } else {
                    console.error("Could not read " + filename);
                    console.info(err);
                }
            });
        }
    };

    Script = function (ast) {
        this.ast = ast;

    };
    Script.prototype = {
        lint: function (complain) {
            var closure,
                body,
                comments;

            closure = new Closure(this.ast);

            if (closure.isActualClosure()) {
                body = closure.body();
            } else {
                complain({
                    message: "The script must be inside a closure",
                    line: this.ast.loc.start.line,
                    column: this.ast.loc.start.column
                });

                body = new Body(this.ast.body);
            }

            comments = new Comments(this.ast.comments);

            body.lint(complain);
            comments.lint(complain);
        }
    };

    Closure = function (ast) {
        this.ast = ast;
    };
    Closure.prototype = {
        isActualClosure: function () {
            return this.ast.body.length === 1 &&
                this.ast.body[0].type === 'ExpressionStatement' &&
                this.ast.body[0].expression.type === 'CallExpression' &&
                this.ast.body[0].expression.callee.type === 'FunctionExpression' &&
                this.ast.body[0].expression.callee.body.type === 'BlockStatement';
        },
        body: function () {
            return this.ast.body[0].expression.callee.body.body;
        }
    };

    Body = function (ast) {
        this.ast = ast;
    };
    Body.prototype = {
        lint: function (complain) {
            var i,
                instruction,
                element;

            for (i = 0; i < this.ast.length; i += 1) {
                instruction = this.ast[i];
                element = this.makeElement(instruction, i);
                if (element !== null) {
                    element.lint(complain);
                } else {
                    console.warn("Unhandled instruction: " + instruction.type);
                }
            }
        },
        makeElement: function (ast, positionInParent) {
            switch (ast.type) {
            case 'ForStatement':
                return new ForStatement(ast, positionInParent);
            case 'VariableDeclaration':
                return new VariableDeclaration(ast, positionInParent);
            case 'FunctionDeclaration':
                return new FunctionDeclaration(ast, positionInParent);
            default:
                return null;
            }
        }
    };

    FunctionDeclaration = function (ast) {
        this.ast = ast;
    };
    FunctionDeclaration.prototype = {
        lint: function (complain) {
            complain({
                message: "Do not declared named functions",
                line: this.ast.loc.start.line,
                column: this.ast.loc.start.column
            });

            new Body(this.ast.body).lint(complain);
        }
    };

    VariableDeclaration = function (ast, positionInParent) {
        this.ast = ast;
        this.positionInParent = positionInParent;
    };
    VariableDeclaration.prototype = {
        lint: function (complain) {
            var i,
                declaration;

            if (this.positionInParent !== 0) {
                complain({
                    message: "Variable declarations must be at the top of functions",
                    line: this.ast.loc.start.line,
                    column: this.ast.loc.start.column
                });
            }

            for (i = 0; i < this.ast.declarations.length; i += 1) {
                declaration = new Declaration(this.ast.declarations[i]);
                declaration.lint(complain);
            }
        }
    };

    Declaration = function (ast) {
        this.ast = ast;
    };
    Declaration.prototype = {
        lint: function (complain) {
            var location;

            location = this.ast.loc;
            if (location.end.line > location.start.line) {
                complain({
                    message: "Variable declaration spans more than one line",
                    line: location.start.line,
                    column: location.start.column
                });
            }
        }
    };

    ForStatement = function (ast) {
        this.ast = ast;
    };
    ForStatement.prototype = {
        lint: function (complain) {

        }
    };

    Comments = function (ast) {
        this.ast = ast;
    };
    Comments.prototype = {
        lint: function (complain) {

        }
    };

    main = function (args) {
        var bastard,
            i,
            complaintHandler;

        complaintHandler = function (complaint) {
            console.log(complaint.filename + ":" +
                complaint.line + ":" +
                complaint.column + ": " +
                complaint.message);
        };

        bastard = new Bastard();
        for (i = 0; i < args.length; i += 1) {
            bastard.lint(args[i], complaintHandler);
        }
    };

    if (require.main === module) {
        main(process.argv.slice(2));
    }
}());
