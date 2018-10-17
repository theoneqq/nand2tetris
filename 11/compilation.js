const fs = require('fs')
const SymbolTable = require('./symbolTable')
const VMWriter = require('./VMWriter')
// 类表
let mainTable
// 子程序表
let subTable
// VMWriter实例 
let vm 
// 局部变量个数
let localNum
// 子程序名字
let funcName

const ifTrueLabel = 'IF_TRUE_'
const ifFalseLabel = 'IF_FALSE_'
const ifEndLabel = 'IF_END_'
const whileLabel = 'WHILE_EXP_'
const whileEndLabel = 'WHILE_END_'

// if
let ifIndex = -1
// while
let whileIndex = -1

let op 
const opObj= {
    '+': 'add',
    '-': 'sub',
    '&amp;': 'and',
    '|': 'or',
    '&lt;': 'lt',
    '&gt;': 'gt',
    '=': 'eq',
    '~': 'not'
}

function CompilationEngine(tokens, fileName) {
    this.fileName = fileName
    // 类名
    this.class = ''
    this.outputPath = fileName + '.xml'
    this.rawFile = fileName + '.jack'
    this.tokens = tokens
    this.len = tokens.length
    this.output = ''
    // index
    this.i = -1

    this._init()
}

CompilationEngine.prototype = {
    _init() {
        mainTable = new SymbolTable()
        subTable = new SymbolTable()
        vm = new VMWriter(this.fileName)

        this._compileClass()
        vm.createVMFile()
    },

    _compileClass() {
        const tokens = this.tokens
        let key, val, temp
        
        temp = this._getNextToken()
        key = temp[0]
        val = temp[1]

        if (val == 'class') {
            this.output += '<class>\r\n'
            this.output += `<${key}> ${val} </${key}>\r\n`

            temp = this._getNextToken()
            key = temp[0]
            val = temp[1]

            if (key == 'identifier') {
                this.output += `<${key}> ${val} </${key}>\r\n`
                this.class = val
                temp = this._getNextToken()
                key = temp[0]
                val = temp[1]

                if (val == '{') {
                    this.output += `<${key}> ${val} </${key}>\r\n`

                    while (this.i < this.len) {
                        let line
                        temp = this._getNextToken()
                        key = temp[0]
                        val = temp[1]
                        line = temp[2]

                        if (val == '}') {
                            this.output += `<${key}> ${val} </${key}>\r\n`
                            break
                        }

                        switch (val) {
                            case 'static':
                            case 'field':
                                this._compileClassVarDec(key, val)
                                break
                            case 'constructor':
                            case 'function':
                            case 'method':
                                // 重置子符号表
                                subTable.startSubroutine()
                                funcName = ''
                                localNum = 0
                                this._compileSubroutine(key, val)
                                break
                            default:
                                this._error(key, val, 'static | field | constructor | function | method')
                        }
                    }
                } else {
                    this._error(key, val, '{')
                }
            } else {
                this._error(key, val, 'identifier')
            }

            this.output += '</class>\r\n'
            this.createXMLFile()
        } else {
            this._error(key, val, 'class')
        }
    },

    _compileClassVarDec(key, val) {
        // type, kind 变量的类型和种类
        let temp, type, kind
        kind = val
        this.output += '<classVarDec>\r\n'
                     + `<${key}> ${val} </${key}>\r\n`

        
        temp = this._getNextToken()
        key = temp[0]
        val = temp[1]
        if (key == 'keyword' || key == 'identifier') {
            this.output += `<${key}> ${val} </${key}>\r\n`

            type = val
            temp = this._getNextToken()
            key = temp[0]
            val = temp[1]

            if (key !== 'identifier') {
                this._error(key, val, 'identifier')
            }

            while (key == 'identifier') {
                this.output += `<${key}> ${val} </${key}>\r\n`
                // 符号表收集变量的各个参数
                mainTable.define(val, type, kind)

                temp = this._getNextToken()
                key = temp[0]
                val = temp[1]

                if (val == ';') {
                    this.output += `<${key}> ${val} </${key}>\r\n`
                    break
                } else if (val == ',') {
                    this.output += `<${key}> ${val} </${key}>\r\n`
                    temp = this._getNextToken()
                    key = temp[0]
                    val = temp[1]
                } else {
                    this._error(key, val, ',|;')
                }
            } 
        } else {
            this._error(key, val, 'keyword')
        }

        this.output += '</classVarDec>\r\n'
    },

    _compileSubroutine(key, val) {
        let temp

        this.output += '<subroutineDec>\r\n'
                     + `<${key}> ${val} </${key}>\r\n`

        temp = this._getNextToken()
        key = temp[0]
        val = temp[1]
        if (key == 'identifier' || key == 'keyword') {
            this.output += `<${key}> ${val} </${key}>\r\n`
            temp = this._getNextToken()
            key = temp[0]
            val = temp[1]

            if (key == 'identifier') {
                this.output += `<${key}> ${val} </${key}>\r\n`
                // 函数名
                funcName = this.class + '.' + val

                temp = this._getNextToken()
                key = temp[0]
                val = temp[1]
            } else {
                this._error(key, val, 'identifier')
            }
        } else {
            this._error(key, val, 'identifier | keyword')
        }

        if (val == '(') {
            this.output += `<${key}> ${val} </${key}>\r\n`

            temp = this._getNextToken()
            key = temp[0]
            val = temp[1]
            if (val == ')') {
                this.output += `<${key}> ${val} </${key}>\r\n`

                temp = this._getNextToken()
                key = temp[0]
                val = temp[1]

                if (val == '{') {
                    this._compileSubroutineBody(key, val)
                } else {
                    this._error(key, val, '{')
                }
            } else {
                this._error(key, val, ')')
            }
        } else {
            this._error(key, val, '(')
        }

        this.output += '</subroutineDec>\r\n'
    },

    _compileSubroutineBody(key, val) {
        let temp, line
        
        this.output += '<subroutineBody>\r\n'
                     + `<${key}> ${val} </${key}>\r\n`

        temp = this._getNextToken()
        key = temp[0]
        val = temp[1]
        line = temp[2]

        while (true) {
            if (val == 'var') {
                this._compileVarDec(key, val)
            } else {
                vm.writeFunction(funcName, localNum)
                this._compileStatements(key, val, line)
            }

            temp = this._getNextToken()
            key = temp[0]
            val = temp[1]
            line = temp[2]

            if (val == '}') {
                this.output += `<${key}> ${val} </${key}>\r\n`
                break
            } else {
                switch (val) {
                    case 'if':
                    case 'while':
                    case 'do':
                    case 'return':
                    case 'let':
                    case 'var':
                        break
                    default:
                        this._error(key, val, '}')
                }
            }
        }
        
        this.output += '</subroutineBody>\r\n'
    },

    _compileParameterList() {
        let key, val, temp, type

        this.output += '<parameterList>\r\n'
        temp = this._getNextToken()
        key = temp[0]
        val = temp[1]

        if (val !== ')') {
            if (key !== 'keyword' && key !== 'identifier') {
                this._error(key, val, 'keyword | identifier')
            } else {
                while (key == 'keyword' || key == 'identifier') {
                    this.output += `<${key}> ${val} </${key}>\r\n`
                    // 类型
                    type = val

                    temp = this._getNextToken()
                    key = temp[0]
                    val = temp[1]
                    if (key == 'identifier') {
                        this.output += `<${key}> ${val} </${key}>\r\n`
                        // 种类
                        subTable.define(val, type, 'argument')

                        temp = this._getNextToken()
                        key = temp[0]
                        val = temp[1]
                        if (val == ',') {
                            this.output += `<${key}> ${val} </${key}>\r\n`
                            temp = this._getNextToken()
                            key = temp[0]
                            val = temp[1]
                        }
                    } else {
                        this._error(key, val, 'identifier')
                    }
                }
            }
        }
        
        this.output += '</parameterList>\r\n'
        this.i--
    },

    _compileVarDec(key, val) {
        let temp, type
        
        this.output += '<varDec>\r\n'
                     + `<${key}> ${val} </${key}>\r\n`
        temp = this._getNextToken()
        key = temp[0]
        val = temp[1]

        if (key == 'keyword' || key == 'identifier') {
            this.output += `<${key}> ${val} </${key}>\r\n`
            // 类型
            type = val

            temp = this._getNextToken()
            key = temp[0]
            val = temp[1]

            if (key !== 'identifier') {
                this._error(key, val, 'identifier')
            }

            while (key == 'identifier') {
                this.output += `<${key}> ${val} </${key}>\r\n`

                // 定义局部变量
                subTable.define(val, type, 'local')
                // 局部变量个数+1
                localNum++

                temp = this._getNextToken()
                key = temp[0]
                val = temp[1]

                if (val == ',') {
                   this.output += `<${key}> ${val} </${key}>\r\n`
                    temp = this._getNextToken()
                    key = temp[0]
                    val = temp[1] 
                } else if (val == ';') {
                    this.output += `<${key}> ${val} </${key}>\r\n`
                    break
                } else {
                    this._error(key, val, ', | ;')
                }
            }
        } else {
            this._error(key, val, 'keyword | identifier')
        }

        this.output += '</varDec>\r\n'

        temp = this._getNextToken()
        key = temp[0]
        val = temp[1]

        if (val == 'var') {
            this._compileVarDec(key, val)
        } else {
            this.i--
        }
    },

    _compileStatements(key, val, line) {
        let temp
        
        this.output += '<statements>\r\n'

        while (val !== '}') {
            switch (val) {
                case 'if':
                    this._compileIf(key, val)
                    break
                case 'while':
                    this._compileWhile(key, val)
                    break
                case 'do':
                    this._compileDo(key, val)
                    break
                case 'return':
                    this._compileReturn(key, val)
                    break
                case 'let':
                    this._compileLet(key, val)
                    break
                default:
                    this._error(key, val, 'if | while | do | return | let')
            }

            temp = this._getNextToken()
            key = temp[0]
            val = temp[1] 
            line = temp[2]
        }
        this.i--
        this.output += '</statements>\r\n'
    },

    _compileDo(key, val) {
        let temp
        
        this.output += '<doStatement>\r\n'
                     + `<${key}> ${val} </${key}>\r\n`

        temp = this._getNextToken()
        key = temp[0]
        val = temp[1] 

        if (key == 'identifier') {
            this.output += `<${key}> ${val} </${key}>\r\n`
            temp = this._getNextToken()
            key = temp[0]
            val = temp[1]
            this._compilePartOfCall(key, val)
            
            temp = this._getNextToken()
            key = temp[0]
            val = temp[1]
            if (val == ';') {
                this.output += `<${key}> ${val} </${key}>\r\n`
            } else {
                this._error(key, val, ';')
            }  
        } else {
            this._error(key, val, 'identifier')
        }
        this.output += '</doStatement>\r\n'
    },

    _compileLet(key, val) {
        let temp
        
        this.output += '<letStatement>\r\n'
                     + `<${key}> ${val} </${key}>\r\n`

        temp = this._getNextToken()
        key = temp[0]
        val = temp[1] 

        if (key == 'identifier') {
            this.output += `<${key}> ${val} </${key}>\r\n`

            temp = this._getNextToken()
            key = temp[0]
            val = temp[1]

            if (val == '[') {
                this.output += `<${key}> ${val} </${key}>\r\n`
                this._compileExpression()
                temp = this._getNextToken()
                key = temp[0]
                val = temp[1]

                if (val == ']') {
                    this.output += `<${key}> ${val} </${key}>\r\n`
                    temp = this._getNextToken()
                    key = temp[0]
                    val = temp[1]

                    if (val == '=') {
                        this.output += `<${key}> ${val} </${key}>\r\n`
                        this._compileExpression()
                    } else {
                        this._error(key, val, '=')
                    }
                } else {
                    this._error(key, val, ']')
                }
            } else if (val == '=') {
                this.output += `<${key}> ${val} </${key}>\r\n`
                this._compileExpression()
            } else {
                this._error(key, val, '[ | =')
            }

            temp = this._getNextToken()
            key = temp[0]
            val = temp[1]

            if (val == ';') {
                this.output += `<${key}> ${val} </${key}>\r\n`
            } else {
                this._error(key, val, ';')
            }
        } else {
            this._error(key, val, 'identifier')
        }
        this.output += '</letStatement>\r\n'
    },

    _compileWhile(key, val) {
        let temp
        whileIndex++
        this.output += '<whileStatement>\r\n'
                     + `<${key}> ${val} </${key}>\r\n`

        temp = this._getNextToken()
        key = temp[0]
        val = temp[1]

        vm.writeLabel(whileLabel + whileIndex)
        if (val == '(') {
            this.output += `<${key}> ${val} </${key}>\r\n`
            this._compileExpression()
            vm.writeArithmetic('not')
            vm.writeIf(whileEndLabel + whileIndex)

            temp = this._getNextToken()
            key = temp[0]
            val = temp[1]

            if (val == ')') {
                this.output += `<${key}> ${val} </${key}>\r\n`
                temp = this._getNextToken()
                key = temp[0]
                val = temp[1]
                line = temp[2]

                if (val == '{') {
                    this.output += `<${key}> ${val} </${key}>\r\n`
                    
                    temp = this._getNextToken()
                    key = temp[0]
                    val = temp[1]
                    line = temp[2]
                    this._compileStatements(key, val, line)

                    temp = this._getNextToken()
                    key = temp[0]
                    val = temp[1]

                    vm.writeGoto(whileLabel + whileIndex)
                    vm.writeLabel(whileEndLabel + whileIndex)

                    if (val == '}') {
                        this.output += `<${key}> ${val} </${key}>\r\n`
                    } else {
                        this._error(key, val, '}')
                    }
                } else {
                    this._error(key, val, '{')
                }
            } else {
                this._error(key, val, ')')
            }
        } else {
            this._error(key, val, '(')
        }
        this.output += '</whileStatement>\r\n'
    },

    _compileIf(key, val) {
        let temp
        
        this.output += '<ifStatement>\r\n'
                     + `<${key}> ${val} </${key}>\r\n`

        temp = this._getNextToken()
        key = temp[0]
        val = temp[1] 

        if (val == '(') {
            this.output += `<${key}> ${val} </${key}>\r\n`
            this._compileExpression()

            temp = this._getNextToken()
            key = temp[0]
            val = temp[1]

            if (val == ')') {
                this.output += `<${key}> ${val} </${key}>\r\n`

                temp = this._getNextToken()
                key = temp[0]
                val = temp[1]

                ifIndex++
                vm.writeIf(ifTrueLabel + ifIndex)
                vm.writeGoto(ifFalseLabel + ifIndex)

                if (val == '{') {
                    this.output += `<${key}> ${val} </${key}>\r\n`
                    temp = this._getNextToken()
                    let line
                    key = temp[0]
                    val = temp[1] 
                    line = temp[2]

                    vm.writeLabel(ifTrueLabel + ifIndex)

                    this._compileStatements(key, val, line)

                    temp = this._getNextToken()
                    key = temp[0]
                    val = temp[1] 

                    vm.writeGoto(ifEndLabel + ifIndex)
                    if (val == '}') {
                        this.output += `<${key}> ${val} </${key}>\r\n`

                        temp = this._getNextToken()
                        key = temp[0]
                        val = temp[1] 

                        if (val == 'else') {
                            vm.writeLabel(ifFalseLabel + ifIndex)
                            this._compileElse(key, val)
                            vm.writeGoto(ifEndLabel + ifIndex)
                        } else {
                            this.i--
                        }
                        vm.writeLabel(ifEndLabel + ifIndex)
                    } else {
                        this._error(key, val, '}')
                    }
                } else {
                    this._error(key, val, ')')
                }
            } else {
                this._error(key, val, ')')
            }
        } else {
            this._error(key, val, '(')
        }

        this.output += '</ifStatement>\r\n'
    },  

    _compileElse(key, val) {
        let temp, line
        this.output += `<${key}> ${val} </${key}>\r\n`

        temp = this._getNextToken()
        key = temp[0]
        val = temp[1]

        if (val == '{') {
            this.output += `<${key}> ${val} </${key}>\r\n`
            temp = this._getNextToken()
            key = temp[0]
            val = temp[1]
            line = temp[2]
            this._compileStatements(key, val, line)

            temp = this._getNextToken()
            key = temp[0]
            val = temp[1]

            if (val == '}') {
                this.output += `<${key}> ${val} </${key}>\r\n`
            } else {
                this._error(key, val, '}')
            }
        } else {
            this._error(key, val, '{')
        }
    },

    _compileReturn(key, val) {
        let temp
        
        this.output += '<returnStatement>\r\n'
                     + `<${key}> ${val} </${key}>\r\n`

        temp = this._getNextToken()
        key = temp[0]
        val = temp[1]

        if (val == ';') {
            this.output += `<${key}> ${val} </${key}>\r\n`
        } else {
            this.i--
            this._compileExpression()
            temp = this._getNextToken()
            key = temp[0]
            val = temp[1]

            if (val == ';') {
                this.output += `<${key}> ${val} </${key}>\r\n`
            } else {
                this._error(key, val, ';')
            }
        }
        
        this.output += '</returnStatement>\r\n'
    },

    _compileExpression() {
        let key, val, temp, line

        this.output += '<expression>\r\n'
        temp = this._getNextToken()
        key = temp[0]
        val = temp[1] 
        line = temp[2]

        if (val == ',') {
            let error = 'line:' + line + ' The expression should not begin with a ,'
                      + '\r\nat ' + this.rawFile
            throw error
        }

        while (true) {
            if (key == 'identifier' || key == 'integerConstant' || key == 'stringConstant') {

                let segment = subTable.kindOf(val)
                if (segment == 'none') {
                    segment = mainTable.kindOf(val)
                    if (segment != 'none') {
                        vm.writePush(segment, mainTable.indexOf(val))
                    }
                } else {
                    vm.writePush(segment, subTable.indexOf(val))
                }

                this._compileTerm(key, val)
                if (op) {
                    vm.writeArithmetic(op)
                    op = ''
                }
            } else if (val == '-' || val == '~') { 
                let preObj = this.tokens[this.i - 1]
                let preKey = Object.keys(preObj)[0]
                let preVal = preObj[key]
                
                if (preKey == 'identifier' || preVal == ')') {
                    // 正常的op
                    this.output += `<${key}> ${val} </${key}>\r\n`
                } else {
                    // 针对负数和取反操作
                    this._compileTerm(key, val)

                    if (val == '-') {
                        vm.writeArithmetic('neg')
                    } else {
                        vm.writeArithmetic('not')
                    }
                }
            } else {
                switch (val) {
                    case 'true':
                    case 'false':
                    case 'null':
                    case 'this':
                    case '(':
                        this._compileTerm(key, val)
                        break
                    default:
                        this.output += `<${key}> ${val} </${key}>\r\n`
                        op = opObj[val]
                }
            }

            temp = this._getNextToken()
            key = temp[0]
            val = temp[1]

            if (val == ')' || val == ';' || val == ']' || val == ',') {
                this.i--
                break
            }
        }

        this.output += '</expression>\r\n'
    },

    _compileTerm(key, val) {
        let temp
        
        this.output += '<term>\r\n'
                     
        if (val == '(') {
            this.output += `<${key}> ${val} </${key}>\r\n`
            this._compileExpression()

            temp = this._getNextToken()
            key = temp[0]
            val = temp[1]
            if (val == ')') {
                this.output += `<${key}> ${val} </${key}>\r\n`
            } else {
                this._error(key, val , ')')
            }
        } else if (val == '-' || val == '~') {
            this.output += `<${key}> ${val} </${key}>\r\n`
            temp = this._getNextToken()
            key = temp[0]
            val = temp[1]

            if (val != ')' && val != ']') {
                this._compileTerm(key, val)
            } 
        } else {
            this.output += `<${key}> ${val} </${key}>\r\n`
            temp = this._getNextToken()
            key = temp[0]
            val = temp[1]

            if (val == '[') {
                this.output += `<${key}> ${val} </${key}>\r\n`
                this._compileExpression()
                temp = this._getNextToken()
                key = temp[0]
                val = temp[1]
                
                if (val == ']') {                       
                    this.output += `<${key}> ${val} </${key}>\r\n`
                } else {
                    this._error(key, val, ']')
                }
            } else if (val == '.' || val == '(') {
                this._compilePartOfCall(key, val)
            } else {
                this.i--
            }
        }

        this.output += '</term>\r\n'
    },

    _compilePartOfCall(key, val) {
        let temp
        if (val == '(') {
            this.output += `<${key}> ${val} </${key}>\r\n`
            this._compileExpressionList()
            temp = this._getNextToken()
            key = temp[0]
            val = temp[1]

            if (val == ')') {
                this.output += `<${key}> ${val} </${key}>\r\n`
            } else {
                this._error(key, val, ')')
            }
        } else if (val == '.') {
            this.output += `<${key}> ${val} </${key}>\r\n`
            temp = this._getNextToken()
            key = temp[0]
            val = temp[1]

            if (key == 'identifier') {
                this.output += `<${key}> ${val} </${key}>\r\n`
                temp = this._getNextToken()
                key = temp[0]
                val = temp[1]
                if (val == '(') {
                    this.output += `<${key}> ${val} </${key}>\r\n`
                    this._compileExpressionList()
                    temp = this._getNextToken()
                    key = temp[0]
                    val = temp[1]

                    if (val == ')') {
                        this.output += `<${key}> ${val} </${key}>\r\n`
                    } else {
                        this._error(key, val, ')')
                    }
                } else {
                    this.error(key, val, '(')
                }
            } else {
                this.error(key, val, 'identifier')
            }
        } else {
            this._error(key, val, '( | .')
        }
    },

    _compileExpressionList() {
        let key, val, temp
        
        temp = this._getNextToken()
        key = temp[0]
        val = temp[1]

        this.output += '<expressionList>\r\n'

        if (val == ')' || val == ',') {
            this.i--
        } else {
            this.i--
            while (true) {
                this._compileExpression()
                temp = this._getNextToken()
                key = temp[0]
                val = temp[1]

                if (val == ',') {
                    this.output += `<${key}> ${val} </${key}>\r\n`
                } else if (val == ')') {
                    this.i--
                    break
                }
            }
        }

        this.output += '</expressionList>\r\n'
    },

    createXMLFile() {
        fs.writeFileSync(this.outputPath, this.output)
    },

    _getNextToken() {
        this.i++
        let obj = this.tokens[this.i]
        let key = Object.keys(obj)[0]
        let val = obj[key]

        return [key, val, obj.line]
    },

    _error(key, val, type) {
        let error = 'line:' + this.tokens[this.i].line + ' syntax error: {' + key + ': ' + val 
                  + '}\r\nExpect the type of key to be ' + type + '\r\nat ' + this.rawFile
        throw error
    }
}

module.exports = CompilationEngine