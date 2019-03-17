const EOF = void 0
// lexer
class HTMLLexicalParser {
  state = this.data
  token = null
  attribute = null
  characterReference = ''

  constructor(syntaxer) {
    this.syntaxer = syntaxer
  }

  receiveInput(char) {
    if (this.state == null) {
      throw new Error('there is an error')
    } else {
      // enter different state
      this.state = this.state(char)
    }
  }

  reset() {
    this.state = this.data
  }

  data (c) {
    switch (c) {
      case '&':
        return this.characterReferenceInData
      case '<':
        return this.tagOpen
      // perhaps will not encounter in javascript?
      // case '\0':
      //   error()
      //   emitToken(c)
      //   return data
      //  can be handle by default case
      // case EOF:
      //   emitToken(EOF)
      //   return data

      default:
        this.emitToken(c)
        return this.data
    }
  }

  // only handle right character reference
  characterReferenceInData (c) {
    if (c === ';') {
      this.characterReference += c
      this.emitToken(this.characterReference)
      this.characterReference = ''
      return this.data
    } else {
      this.characterReference += c
      return this.characterReferenceInData
    }
  }

  tagOpen(c) {
    if (c === '/') {
      return this.endTagOpen
    }
    if (/[a-zA-Z]/.test(c)) {
      this.token = new StartTagToken()
      this.token.name = c.toLowerCase()
      return this.tagName
    }
    return this.error(c)
  }


  tagName (c) {
    if  (c === '/') {
      return this.selfClosingTag
    }
    // tab space next-page next-line
    if  (/[\t \f\n]/.test(c)) {
      return this.beforeAttributeName
    }
    if (c === '>') {
      this.emitToken(this.token)
      return this.data
    }
    if (/[a-zA-Z]/.test(c)) {
      this.token.name += c.toLowerCase()
      return this.tagName
    }
  }

  beforeAttributeName (c) {
    if (/[\t \f\n]/.test(c)) {
      return this.beforeAttributeName
    }
    if (c === '/') {
      return this.selfClosingTag
    }
    if (c === '>') {
      this.emitToken(this.token)
      return this.data
    }
    if (/["'<]/.test(c)) {
      return this.error(c)
    }

    this.attribute = new Attribute()
    this.attribute.name = c.toLowerCase()
    this.attribute.value = ''
    return this.attributeName
  }

  attributeName (c) {
    if (c === '/') {
      this.token[this.attribute.name] = this.attribute.value
      return this.selfClosingTag
    }
    if (c === '=') {
      return this.beforeAttributeValue
    }
    if (/[\t \f\n]/.test(c)) {
      return this.beforeAttributeName
    }
    this.attribute.name += c.toLowerCase()
    return this.attributeName
  }

  beforeAttributeValue (c) {
    if (c === '"') {
      return this.attributeValueDoubleQuoted
    }
    if (c === "'") {
      return this.attributeValueSingleQuoted
    }
    if (/\t \f\n/.test(c)) {
      return this.beforeAttributeValue
    }
    this.attribute.value += c
    return this.attributeValueUnquoted
  }

  attributeValueDoubleQuoted (c) {
    if (c === '"') {
      this.token[this.attribute.name] = this.attribute.value
      return this.beforeAttributeName
    }
    this.attribute.value += c
    return this.attributeValueDoubleQuoted
  }

  attributeValueSingleQuoted (c) {
    if (c === "'") {
      this.token[this.attribute.name] = this.attribute.value
      return this.beforeAttributeName
    }
    this.attribute.value += c
    return this.attributeValueSingleQuoted
  }

  attributeValueUnquoted (c) {
    if (/[\t \f\n]/.test(c)) {
      this.token[attribute.name] = this.attribute.value
      return this.beforeAttributeName
    }
    this.attribute.value += c
    return this.attributeValueUnquoted
  }

  selfClosingTag (c) {
    if (c === '>') {
      this.emitToken(this.token)
      this.endToken = new EndTagToken()
      this.endToken.name = this.token.name
      this.emitToken(this.endToken)
      return this.data
    }
  }

  endTagOpen (c) {
    if (/[a-zA-Z]/.test(c)) {
      this.token = new EndTagToken()
      this.token.name = c.toLowerCase()
      return this.tagName
    }
    if (c === '>') {
      return error(c)
    }
  }

  emitToken (token) {
    this.syntaxer.receiveInput(token)
  }

  error (c) {
    console.log(`warn: unexpected char '${c}'`)
  }
}

class StartTagToken {}

class EndTagToken {}

class Attribute {}


// syntaxer
class HTMLDocument {
  constructor () {
    this.isDocument = true
    this.childNodes = []
  }
}
class Node {}
class Element extends Node {
  constructor (token) {
    super(token)
    for (const key in token) {
      this[key] = token[key]
    }
    this.childNodes = []
  }
  [Symbol.toStringTag] () {
    return `Element<${this.name}>`
  }
}
class Text extends Node {
  constructor (value) {
    super(value)
    this.value = value || ''
  }
}

function HTMLSyntaticalParser () {
  const stack = [new HTMLDocument]

  this.receiveInput = function (token) {
    if (typeof token === 'string') {
      if (getTop(stack) instanceof Text) {
        getTop(stack).value += token
      } else {
        let t = new Text(token)
        getTop(stack).childNodes.push(t)
        stack.push(t)
      }
    } else if (getTop(stack) instanceof Text) {
      stack.pop()
    }

    if (token instanceof StartTagToken) {
      let e = new Element(token)
      getTop(stack).childNodes.push(e)
      return stack.push(e)
    }
    if (token instanceof EndTagToken) {
      return stack.pop()
    }
  }

  this.getOutput = () => stack[0]
}

function getTop (stack) {
  return stack[stack.length - 1]
}


// Example
const syntaxer = new HTMLSyntaticalParser()
const lexer = new HTMLLexicalParser(syntaxer)

const testHTML = `<html lang="en" >
    <head>
      <title>cool</title>
    </head>
    <body>
      <img src="a" />
    </body>
</html>`

for (let c of testHTML) {
  lexer.receiveInput(c)
}

console.log(JSON.stringify(syntaxer.getOutput(), null, 2))
