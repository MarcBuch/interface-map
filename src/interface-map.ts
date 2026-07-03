async function loadTsMorph(): Promise<any> {
  return await import("ts-morph")
}

const SUMMARY_CAP = 120

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function capText(text: string, maxLength = SUMMARY_CAP): string {
  const normalized = normalizeText(text)
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`
}

function numberedLine(lineNumber: number, text: string): string {
  return `[${lineNumber}] ${text}`
}

function modifiersText(node: { getModifiers?: () => { getText(): string }[] }): string {
  const modifiers = node.getModifiers?.().map((modifier) => modifier.getText()) ?? []
  return modifiers.length > 0 ? `${modifiers.join(" ")} ` : ""
}

function typeParametersText(node: { getTypeParameters(): { getText(): string }[] }): string {
  const typeParameters = node.getTypeParameters().map((typeParameter) => typeParameter.getText())
  return typeParameters.length > 0 ? `<${typeParameters.join(", ")}>` : ""
}

function parametersText(node: { getParameters(): { getText(): string }[] }): string {
  return node.getParameters().map((parameter) => parameter.getText()).join(", ")
}

function heritageText(node: { getHeritageClauses(): { getText(): string }[] }): string {
  const clauses = node.getHeritageClauses().map((clause: { getText(): string }) => clause.getText())
  return clauses.length > 0 ? ` ${clauses.join(" ")}` : ""
}

function keySummaryFromObjectLiteral(node: any): string {
  const keys = node
    .getProperties()
    .map((property: any) => {
      if (property.getKindName() === "SpreadAssignment") return null
      if (property.getKindName() === "PropertyAssignment" || property.getKindName() === "ShorthandPropertyAssignment") {
        return property.getName?.() ?? property.getNameNode?.().getText() ?? property.getText()
      }
      if (property.getKindName() === "MethodDeclaration") return property.getName?.() ?? property.getText()
      return property.getText()
    })
    .filter(Boolean)

  return `{ ${keys.join(", ")} }`
}

function memberSignature(member: any, Node: any): string | null {
  if (Node.isPropertyDeclaration(member) || Node.isPropertySignature(member) || Node.isEnumMember(member)) {
    return capText(member.getText())
  }

  if (Node.isMethodDeclaration(member) || Node.isMethodSignature(member)) {
    const name = member.getName() ?? member.getNameNode().getText()
    const returnType = member.getReturnTypeNode()?.getText()
    return `${modifiersText(member)}${name}${typeParametersText(member)}(${parametersText(member)})${returnType ? `: ${returnType}` : ""};`
  }

  if (Node.isConstructorDeclaration(member)) {
    return `${modifiersText(member)}constructor(${parametersText(member)});`
  }

  if (Node.isGetAccessorDeclaration(member)) {
    const returnType = member.getReturnTypeNode()?.getText()
    return `${modifiersText(member)}get ${member.getName()}()${returnType ? `: ${returnType}` : ""};`
  }

  if (Node.isSetAccessorDeclaration(member)) {
    return `${modifiersText(member)}set ${member.getName()}(${parametersText(member)});`
  }

  return null
}

function summarizeTypeAlias(statement: any, Node: any): string {
  const typeNode = statement.getTypeNode?.()
  if (typeNode && typeNode.getKindName?.() === "TypeLiteral") {
    const keys = typeNode
      .getMembers()
      .map((member: any) => {
        if (Node.isPropertySignature(member) || Node.isMethodSignature(member)) {
          return member.getName?.() ?? member.getNameNode?.().getText() ?? member.getText()
        }
        return null
      })
      .filter(Boolean)
    return `type ${statement.getName()} = { ${keys.join(", ")} }`
  }

  return capText(statement.getText())
}

function summarizeExpression(expression: any, Node: any): string {
  if (!expression) return ""

  while (Node.isParenthesizedExpression(expression)) {
    expression = expression.getExpression()
  }

  if (Node.isArrowFunction(expression)) {
    const asyncPrefix = expression.isAsync() ? "async " : ""
    const typeParameters = typeParametersText(expression)
    const returnType = expression.getReturnTypeNode()?.getText()
    return `${asyncPrefix}${typeParameters}${`(${parametersText(expression)})`}${returnType ? `: ${returnType}` : ""} =>`
  }

  if (Node.isFunctionExpression(expression)) {
    const asyncPrefix = expression.isAsync() ? "async " : ""
    const name = expression.getName() ? ` ${expression.getName()}` : ""
    const typeParameters = typeParametersText(expression)
    const returnType = expression.getReturnTypeNode()?.getText()
    return `${asyncPrefix}function${name}${typeParameters}(${parametersText(expression)})${returnType ? `: ${returnType}` : ""}`
  }

  if (Node.isCallExpression(expression)) {
    const calleeNode = expression.getExpression()
    const callee = calleeNode.getText()
    const args = expression.getArguments()
    const firstArg = args[0]

    if (Node.isPropertyAccessExpression(calleeNode)) {
      const propertyName = calleeNode.getName()
      const targetText = calleeNode.getExpression().getText()

      if (targetText === "z" && propertyName === "object" && firstArg && Node.isObjectLiteralExpression(firstArg)) {
        return `z.object(${keySummaryFromObjectLiteral(firstArg)})`
      }

      if (propertyName === "extend" && firstArg && Node.isObjectLiteralExpression(firstArg)) {
        const baseSummary = summarizeExpression(calleeNode.getExpression(), Node)
        return `${baseSummary}.extend(${keySummaryFromObjectLiteral(firstArg)})`
      }
    }

    if (Node.isCallExpression(calleeNode)) {
      const innerCallee = calleeNode.getExpression().getText()
      const innerArgs = calleeNode.getArguments()
      const innerFirstArg = innerArgs[0]
      if (innerCallee === "createFileRoute" && innerFirstArg && Node.isStringLiteral(innerFirstArg)) {
        return `${innerCallee}(${innerFirstArg.getText()})${firstArg && Node.isObjectLiteralExpression(firstArg) ? `(${keySummaryFromObjectLiteral(firstArg)})` : "()"}`
      }
    }

    if (callee === "createFileRoute" && firstArg && Node.isStringLiteral(firstArg)) {
      return `createFileRoute(${firstArg.getText()})`
    }

    if (/\.extend$/.test(callee) && firstArg && Node.isObjectLiteralExpression(firstArg)) {
      return `${callee}(${keySummaryFromObjectLiteral(firstArg)})`
    }

    if (callee === "z.object" && firstArg && Node.isObjectLiteralExpression(firstArg)) {
      return `z.object(${keySummaryFromObjectLiteral(firstArg)})`
    }

    return capText(expression.getText())
  }

  if (Node.isObjectLiteralExpression(expression)) {
    return keySummaryFromObjectLiteral(expression)
  }

  return capText(expression.getText())
}

function summarizeVariableDeclaration(statementModifiers: string, declaration: any, Node: any): string {
  const name = declaration.getNameNode?.().getText() ?? declaration.getName()
  const typeNode = declaration.getTypeNode?.()?.getText()
  const initializer = declaration.getInitializer?.()
  const initializerSummary = summarizeExpression(initializer, Node)

  if (initializerSummary) {
    return `${statementModifiers}${name}${typeNode ? `: ${typeNode}` : ""} = ${initializerSummary}`
  }

  return `${statementModifiers}${name}${typeNode ? `: ${typeNode}` : ""}`
}

function emitModuleMembers(lines: string[], members: any[], Node: any): void {
  for (const member of members) {
    if (Node.isInterfaceDeclaration(member)) {
      lines.push(numberedLine(member.getStartLineNumber(), `${modifiersText(member)}interface ${member.getName()}${typeParametersText(member)}${heritageText(member)} {`))
      for (const child of member.getMembers()) {
        const signature = memberSignature(child, Node)
        if (signature) lines.push(numberedLine(child.getStartLineNumber(), `  ${signature}`))
      }
      lines.push("}")
      continue
    }

    if (Node.isClassDeclaration(member)) {
      lines.push(numberedLine(member.getStartLineNumber(), `${modifiersText(member)}class ${member.getName()}${typeParametersText(member)}${heritageText(member)} {`))
      for (const child of member.getMembers()) {
        const signature = memberSignature(child, Node)
        if (signature) lines.push(numberedLine(child.getStartLineNumber(), `  ${signature}`))
      }
      lines.push("}")
      continue
    }

    if (Node.isEnumDeclaration(member)) {
      lines.push(numberedLine(member.getStartLineNumber(), `${modifiersText(member)}enum ${member.getName()} {`))
      for (const child of member.getMembers()) {
        lines.push(numberedLine(child.getStartLineNumber(), `  ${capText(child.getText())}`))
      }
      lines.push("}")
      continue
    }

    if (Node.isFunctionDeclaration(member)) {
      const name = member.getName() ?? ""
      const returnType = member.getReturnTypeNode()?.getText()
      lines.push(numberedLine(member.getStartLineNumber(), `${modifiersText(member)}function ${name}${typeParametersText(member)}(${parametersText(member)})${returnType ? `: ${returnType}` : ""} {}`))
      continue
    }

    if (Node.isTypeAliasDeclaration(member)) {
      lines.push(numberedLine(member.getStartLineNumber(), `${modifiersText(member)}${summarizeTypeAlias(member, Node)}`))
      continue
    }

    if (Node.isVariableStatement(member)) {
      const statementModifiers = `${modifiersText(member)}${member.getDeclarationKind()} `
      for (const declaration of member.getDeclarations()) {
        lines.push(numberedLine(declaration.getStartLineNumber(), summarizeVariableDeclaration(statementModifiers, declaration, Node)))
      }
      continue
    }

    if (Node.isModuleDeclaration(member)) {
      const name = member.getName()
      const keyword = member.getDeclarationKind?.() ?? "module"
      lines.push(numberedLine(member.getStartLineNumber(), `${modifiersText(member)}${keyword} ${name} {`))
      const body = member.getBody()
      if (body && Node.isModuleBlock(body)) {
        emitModuleMembers(lines, body.getStatements(), Node)
      }
      lines.push("}")
      continue
    }

    if (Node.isExportAssignment(member)) {
      const expression = member.getExpression()
      lines.push(numberedLine(member.getStartLineNumber(), `export default ${summarizeExpression(expression, Node)}`))
      continue
    }

    lines.push(numberedLine(member.getStartLineNumber(), capText(member.getText())))
  }
}

export async function getInterfaceMapTextFromSource(sourceText: string): Promise<string> {
  const { Node, Project } = await loadTsMorph()

  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true })
  const sourceFile = project.createSourceFile("interface-map.ts", sourceText, { overwrite: true })

  const lines: string[] = []

  for (const statement of sourceFile.getStatements()) {
    if (Node.isImportDeclaration(statement) || Node.isImportEqualsDeclaration(statement)) {
      continue
    }

    if (Node.isInterfaceDeclaration(statement)) {
      lines.push(numberedLine(statement.getStartLineNumber(), `${modifiersText(statement)}interface ${statement.getName()}${typeParametersText(statement)}${heritageText(statement)} {`))
      for (const member of statement.getMembers()) {
        const signature = memberSignature(member, Node)
        if (signature) lines.push(numberedLine(member.getStartLineNumber(), `  ${signature}`))
      }
      lines.push("}")
      continue
    }

    if (Node.isClassDeclaration(statement)) {
      lines.push(numberedLine(statement.getStartLineNumber(), `${modifiersText(statement)}class ${statement.getName()}${typeParametersText(statement)}${heritageText(statement)} {`))
      for (const member of statement.getMembers()) {
        const signature = memberSignature(member, Node)
        if (signature) lines.push(numberedLine(member.getStartLineNumber(), `  ${signature}`))
      }
      lines.push("}")
      continue
    }

    if (Node.isFunctionDeclaration(statement)) {
      const name = statement.getName() ?? ""
      const returnType = statement.getReturnTypeNode()?.getText()
      lines.push(numberedLine(statement.getStartLineNumber(), `${modifiersText(statement)}function ${name}${typeParametersText(statement)}(${parametersText(statement)})${returnType ? `: ${returnType}` : ""} {}`))
      continue
    }

    if (Node.isTypeAliasDeclaration(statement)) {
      lines.push(numberedLine(statement.getStartLineNumber(), `${modifiersText(statement)}${summarizeTypeAlias(statement, Node)}`))
      continue
    }

    if (Node.isEnumDeclaration(statement)) {
      lines.push(numberedLine(statement.getStartLineNumber(), `${modifiersText(statement)}enum ${statement.getName()} {`))
      for (const member of statement.getMembers()) {
        lines.push(numberedLine(member.getStartLineNumber(), `  ${capText(member.getText())}`))
      }
      lines.push("}")
      continue
    }

    if (Node.isVariableStatement(statement)) {
      const statementModifiers = `${modifiersText(statement)}${statement.getDeclarationKind()} `
      for (const declaration of statement.getDeclarations()) {
        lines.push(numberedLine(declaration.getStartLineNumber(), summarizeVariableDeclaration(statementModifiers, declaration, Node)))
      }
      continue
    }

    if (Node.isModuleDeclaration(statement)) {
      const name = statement.getName()
      const keyword = statement.getDeclarationKind?.() ?? "module"
      lines.push(numberedLine(statement.getStartLineNumber(), `${modifiersText(statement)}${keyword} ${name} {`))
      const body = statement.getBody()
      if (body && Node.isModuleBlock(body)) {
        emitModuleMembers(lines, body.getStatements(), Node)
      }
      lines.push("}")
      continue
    }

    if (Node.isExportAssignment(statement)) {
      lines.push(numberedLine(statement.getStartLineNumber(), `export default ${summarizeExpression(statement.getExpression(), Node)}`))
      continue
    }

    if (Node.isExportDeclaration(statement)) {
      continue
    }

    lines.push(numberedLine(statement.getStartLineNumber(), capText(statement.getText())))
  }

  return lines.join("\n")
}

export async function getInterfaceMapText(filePath: string): Promise<string> {
  const { Project } = await loadTsMorph()
  const project = new Project({ skipAddingFilesFromTsConfig: true })
  const sourceFile = project.addSourceFileAtPath(filePath)
  return await getInterfaceMapTextFromSource(sourceFile.getFullText())
}
