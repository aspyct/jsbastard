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
        Declaration,
        Context,
        ExpressionTypes,
        InstructionTypes;

    Context = function (parent) {
        this.parent = parent !== undefined ? parent : null;
        this.usingStrict = false;
        this.position = 0;
    };

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
                }, new Context());
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
        lint: function (complain, parentContext) {
            var closure,
                body,
                comments,
                context;

            context = new Context(parentContext);
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

            body.lint(complain, context);
            comments.lint(complain, context);
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
            return new Body(this.ast.body[0].expression.callee.body.body);
        }
    };

    Body = function (ast) {
        this.ast = ast;
    };
    Body.prototype = {
        lint: function (complain, parentContext) {
            var i,
                instruction,
                instructionAst,
                context;

            context = new Context(parentContext);

            for (i = 0; i < this.ast.length; i += 1) {
                instructionAst = this.ast[i];
                instruction = this.makeInstruction(instructionAst);
                if (instruction !== null) {
                    instruction.lint(complain, context);
                }
                context.position += 1;
            }
        },
        makeInstruction: function (ast) {
            if (InstructionTypes.hasOwnProperty(ast.type)) {
                return new InstructionTypes[ast.type](ast);
            }

            console.warn("Unhandled instruction type: " + ast.type);
            return null;
        }
    };

    InstructionTypes = {
        FunctionDeclaration: function (ast) {
            this.ast = ast;
        },
        VariableDeclaration: function (ast) {
            this.ast = ast;
        },
        ForStatement: function (ast) {
            this.ast = ast;
        },
        EmptyStatement: function (ast) {
            this.ast = ast;
        },
        ExpressionStatement: function (ast) {
            this.ast = ast;
        },
        IfStatement: function (ast) {
            this.ast = ast;
        }
    };

    InstructionTypes.FunctionDeclaration.prototype = {
        lint: function (complain, parentContext) {
            var body;

            complain({
                message: "Do not declare named functions",
                line: this.ast.loc.start.line,
                column: this.ast.loc.start.column
            });

            body = new Body(this.ast.body.body);
            body.lint(complain, new Context(parentContext));
        }
    };

    InstructionTypes.EmptyStatement.prototype = {
        lint: function (complain) {
            complain({
                message: "Empty statement",
                line: this.ast.loc.start.line,
                column: this.ast.loc.start.column
            });
        }
    };

    InstructionTypes.ExpressionStatement.prototype = {
        lint: function (complain, parentContext) {
            var expression,
                context;

            context = new Context(parentContext);

            if (this.isUseStrict()) {
                parentContext.usingStrict = true;
            } else {
                expression = this.makeExpression(this.ast.expression);

                if (expression !== null) {
                    expression.lint(complain, context);
                }
            }
        },
        isUseStrict: function () {
            return this.ast.type === 'ExpressionStatement' &&
                this.ast.expression.type === 'Literal' &&
                this.ast.expression.value === 'use strict';
        },
        makeExpression: function (ast) {
            if (ExpressionTypes.hasOwnProperty(ast.type)) {
                return new ExpressionTypes[ast.type](ast.expression);
            }

            console.warn("Unhandled expression type: " + ast.type);
            return null;
        }
    };

    ExpressionTypes = {
        AssignmentExpression: function (ast) {
            this.ast = ast;
        }
    };

    ExpressionTypes.AssignmentExpression.prototype = {
        lint: function (complain, parentContext) {
            
        }
    };

    InstructionTypes.IfStatement.prototype = {
        lint: function (complain) {

        }
    };

    InstructionTypes.VariableDeclaration.prototype = {
        lint: function (complain, parentContext) {
            var i,
                declaration;

            if (!this.isFirstInContext(parentContext)) {
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
        },
        isFirstInContext: function (parentContext) {
            return parentContext.position === 0 ||
                (parentContext.position === 1 && parentContext.usingStrict);
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
