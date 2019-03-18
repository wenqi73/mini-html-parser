const SLASH      = '/';
const OPEN_TAG   = '<';
const CLOSED_TAG = '>';
const LETTER     = /[a-zA-Z]/;
const SPACE_OR_NEW_LINE   = /[\t \f\n]/;

// lexer
class HTMLLexicalParser {
  state = this.initState
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
    this.state = this.initState
  }

  initState (c) {
    switch (c) {
      case '&':
        return this.toCharacterEntity
      case OPEN_TAG:
        return this.tagOpen
      default:
        this.emitToken(c)
        return this.initState
    }
  }

  // only handle right character reference
  toCharacterEntity (c) {
    if (c === ';') {
      this.characterReference += c
      this.emitToken(this.characterReference)
      this.characterReference = ''
      return this.initState
    } else {
      this.characterReference += c
      return this.toCharacterEntity
    }
  }

  tagOpen(c) {
    if (c === SLASH) {
      return this.endTagOpen
    }
    if (LETTER.test(c)) {
      this.token = new StartTagToken()
      this.token.name = c.toLowerCase()
      return this.tagName
    }
    return this.error(c)
  }

  tagName(c) {
    if  (c === SLASH) {
      return this.selfClosingTag
    }
    // tab space next-page next-line
    if  (SPACE_OR_NEW_LINE.test(c)) {
      return this.beforeAttributeName
    }
    if (c === CLOSED_TAG) {
      this.emitToken(this.token)
      return this.initState
    }
    if (LETTER.test(c)) {
      this.token.name += c.toLowerCase()
      return this.tagName
    }
  }

  beforeAttributeName(c) {
    if (SPACE_OR_NEW_LINE.test(c)) {
      return this.beforeAttributeName
    }
    if (c === SLASH) {
      return this.selfClosingTag
    }
    if (c === CLOSED_TAG) {
      this.emitToken(this.token)
      return this.initState
    }
    if (/["'<]/.test(c)) {
      return this.error(c)
    }

    this.attribute = new Attribute()
    this.attribute.name = c.toLowerCase()
    this.attribute.value = ''
    return this.attributeName
  }

  attributeName(c) {
    if (c === SLASH) {
      this.token[this.attribute.name] = this.attribute.value
      return this.selfClosingTag
    }
    if (c === '=') {
      return this.beforeAttributeValue
    }
    if (SPACE_OR_NEW_LINE.test(c)) {
      return this.beforeAttributeName
    }
    this.attribute.name += c.toLowerCase()
    return this.attributeName
  }

  beforeAttributeValue(c) {
    if (c === '"') {
      return this.attributeValueDoubleQuoted
    }
    if (c === "'") {
      return this.attributeValueSingleQuoted
    }
    if (SPACE_OR_NEW_LINE.test(c)) {
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
    if (SPACE_OR_NEW_LINE.test(c)) {
      this.token[this.attribute.name] = this.attribute.value
      return this.beforeAttributeName
    }
    this.attribute.value += c
    return this.attributeValueUnquoted
  }

  selfClosingTag (c) {
    if (c === CLOSED_TAG) {
      this.emitToken(this.token)
      this.endToken = new EndTagToken()
      this.endToken.name = this.token.name
      this.emitToken(this.endToken)
      return this.initState
    }
  }

  endTagOpen (c) {
    if (LETTER.test(c)) {
      this.token = new EndTagToken()
      this.token.name = c.toLowerCase()
      return this.tagName
    }
    if (c === CLOSED_TAG) {
      return this.error(c)
    }
  }

  emitToken(token) {
    this.syntaxer.receiveToken(token)
  }

  error(c) {
    // eslint-disable-next-line no-console
    console.log(`warn: unexpected char '${c}'`)
  }
}

class StartTagToken {}

class EndTagToken {}

class Attribute {}

// syntaxer
class HTMLDocument {
  constructor() {
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

class HTMLSyntacticParser {
  stack = [new HTMLDocument]

  /**
   * receive token passed by lexer
   * @param {*} token 
   */
  receiveToken(token) {
    console.log(token);
    // string between start and end tag
    // like <span>this is a span</span>, 'this is a span' is the value
    if (typeof token === 'string') {
      if (this.topStack instanceof Text) {
        this.topStack.value += token
      } else {
        // create new Text at start
        let t = new Text(token)
        this.topStack.childNodes.push(t)
        this.stack.push(t)
      }
    } else if (this.topStack instanceof Text) {
      // meet start tag or end tag
      this.stack.pop()
    }

    /**
     * push start tag, pop same tag when it's end
     */
    if (token instanceof StartTagToken) {
      let e = new Element(token)
      this.topStack.childNodes.push(e)
      return this.stack.push(e)
    }
    if (token instanceof EndTagToken) {
      return this.stack.pop()
    }
  }

  getOutput() {
    return this.stack[0];
  }

  get topStack() {
    return this.stack[this.stack.length - 1]
  }
}

// Example
const syntaxer = new HTMLSyntacticParser()
const lexer = new HTMLLexicalParser(syntaxer)
const testHTML = `
  <html lang="en">
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
